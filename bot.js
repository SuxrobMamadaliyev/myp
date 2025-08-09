const { Telegraf, Markup, session } = require('telegraf');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Botni yaratamiz
const bot = new Telegraf(process.env.BOT_TOKEN);

// --- Almaz narxlari ---
const ALMAZ_PRICES = {
  100: 15000,
  200: 29000,
  500: 70000
};

// --- PUBG Mobile UC narxlari (kengaytirilgan) ---
const UC_PRICES = {
  '60': 15000,
  '120': 30000,
  '180': 45000,
  '325': 75000,
  '500': 115000,
  '660': 150000,
  '900': 200000,
  '1375': 300000,
  '1800': 390000,
  '2400': 525000,
  '3000': 650000,
  '4000': 875000,
  '5000': 1100000,
  '6000': 1320000,
  '7000': 1540000,
  '8000': 1750000,
  '10000': 2200000,
  '12000': 2600000,
  '15000': 3250000,
  '20000': 4300000,
  '25000': 5300000,
  '30000': 6300000,
  '35000': 7300000,
  '40000': 8300000,
  '50000': 10300000,
  '60000': 12300000,
  '70000': 14300000,
  '80000': 16300000,
  '90000': 18300000,
  '100000': 20000000,
  '11950': 1660000,
  '16200': 2200000
};

// --- PUBG Mobile PP narxlari (kengaytirilgan) ---
const PP_PRICES = {
  '50': 10000,
  '100': 20000,
  '200': 40000,
  '300': 60000,
  '500': 100000,
  '750': 150000,
  '1000': 200000,
  '1500': 300000,
  '2000': 400000,
  '2500': 500000,
  '3000': 600000,
  '4000': 800000,
  '5000': 1000000,
  '7500': 1500000,
  '10000': 2000000,
  '15000': 3000000,
  '20000': 4000000,
  '25000': 5000000,
  '30000': 6000000,
  '40000': 8000000,
  '50000': 10000000,
  '60000': 12000000,
  '70000': 14000000,
  '80000': 16000000,
  '90000': 18000000,
  '100000': 20000000
};

// Session middleware barcha sozlamalar uchun
bot.use(session({
  defaultSession: () => ({
    // Almaz sotib olish uchun
    almax: { step: null, amount: null },
    // Balans to'ldirish uchun
    topup: { step: null, amount: null },
    // Buyurtma uchun
    buying: null,
    // Promokodlar uchun
    awaitingPromo: false,
    awaitingNewPromo: false,
    awaitingFindUser: false,
    awaitingBroadcast: false
  })
}));

// --- Almaz sotib olish bosqichlari ---
bot.action('buy:almaz', async (ctx) => {
  ctx.session.almaz = { step: 'amount' };
  
  // Get current prices from environment variables
  const ffPrices = getFfPrices();
  
  // Prepare keyboard with current prices
  const keyboard = [];
  
  // Add diamond packages (100, 200, 500, 1000, 2000)
  [100, 200, 500, 1000, 2000].forEach(amount => {
    const price = ffPrices[amount];
    if (price) {
      keyboard.push([
        Markup.button.callback(
          `${amount} Almaz - ${price.toLocaleString()} so'm`,
          `almaz:amount:${amount}`
        )
      ]);
    }
  });
  
  // Add back button
  keyboard.push([Markup.button.callback('⬅️ Orqaga', 'back:main')]);
  
  await sendOrUpdateMenu(ctx, '💎 *Free Fire Almaz Sotib Olish*\n\nQancha Almaz sotib olmoqchisiz?', keyboard);
});

bot.action(/almaz:amount:(\d+)/, async (ctx) => {
  const amount = parseInt(ctx.match[1]);
  const userId = ctx.from.id;
  const ffPrices = getFfPrices();
  const price = ffPrices[amount];
  
  if (!price) {
    await ctx.answerCbQuery('❌ Uzr, bu miqdordagi Almas hozir mavjud emas');
    return;
  }
  
  const userBalance = getUserBalance(userId);
  if (userBalance < price) {
    await sendOrUpdateMenu(
      ctx,
      `❌ Mablag' yetarli emas!\n\n💳 Balans: ${userBalance.toLocaleString()} so'm\n💰 Kerak: ${price.toLocaleString()} so'm\n\nBalansingizni to'ldiring va qayta urinib ko'ring.`,
      [
        [Markup.button.callback('💳 Balansni to\'ldirish', 'topup:amount')],
        [Markup.button.callback('⬅️ Orqaga', 'back:main')]
      ]
    );
    delete ctx.session.almaz;
    return;
  }
  ctx.session.almaz = { step: 'uid', amount };
  await sendOrUpdateMenu(ctx, `Free Fire ID raqamingizni kiriting:\n\nMasalan: 123456789`, [
    [Markup.button.callback('⬅️ Orqaga', 'back:main')]
  ]);
});

// UID va balans tekshirish
bot.on('text', async (ctx, next) => {
  if (ctx.session.almaz && ctx.session.almaz.step === 'uid') {
    const uid = ctx.message.text.trim();
    const amount = ctx.session.almaz.amount;
    const ffPrices = getFfPrices();
    const price = ffPrices[amount];
    
    if (!price) {
      await ctx.reply('❌ Uzr, bu miqdordagi Almas hozir mavjud emas');
      return;
    }
    
    const userId = ctx.from.id;
    if (!/^[0-9]{5,}$/.test(uid)) {
      await ctx.reply('❌ Iltimos, to\'g\'ri Free Fire ID raqamini kiriting!');
      return;
    }
    // Adminlarga buyurtma yuborish
    const orderId = generateOrderId();
    ctx.session.almaz = undefined;
    pendingOrders[orderId] = { userId, type: 'almaz', amount, uid, price };
    const adminMessage = `💎 *Yangi Almaz buyurtma*\n` +
      `🆔 Buyurtma ID: ${orderId}\n` +
      `💎 Miqdor: ${amount} Almaz\n` +
      `🎮 UID: ${uid}\n` +
      `💰 Summa: ${price.toLocaleString()} so'm\n` +
      `👤 Foydalanuvchi: ${ctx.from.username || ctx.from.first_name || userId} (ID: ${userId})`;
    const adminKeyboard = [
      [
        Markup.button.callback('✅ Tasdiqlash', `confirm_almaz:${orderId}`),
        Markup.button.callback('❌ Bekor qilish', `cancel_order:${orderId}`)
      ]
    ];
    for (const adminId of ADMIN_IDS) {
      try {
        await ctx.telegram.sendMessage(
          adminId,
          adminMessage,
          { parse_mode: 'Markdown', reply_markup: { inline_keyboard: adminKeyboard } }
        );
      } catch (e) {}
    }
    await ctx.reply(`✅ Buyurtmangiz qabul qilindi!\n\n💎 Miqdor: ${amount} Almaz\n🎮 UID: ${uid}\n💰 Summa: ${price.toLocaleString()} so'm\n\nTez orada admin tasdiqlaydi.`);
    return;
  }
  return next();
});

// Admin tasdiqlasa balansdan pul yechish (Free Fire Almaz)
bot.action(/confirm_almaz:(\w+)/, async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.answerCbQuery('Ruxsat yo\'q!');
    return;
  }
  
  const orderId = ctx.match[1];
  const order = pendingOrders[orderId];
  if (!order || order.type !== 'almaz') {
    await ctx.answerCbQuery('Buyurtma topilmadi!');
    return;
  }
  
  const { userId, amount, uid, price } = order;  // price is from the stored order
  const userBalance = getUserBalance(userId);
  if (userBalance < price) {
    await ctx.reply(`❌ Foydalanuvchida yetarli mablag' yo'q. Balans: ${userBalance.toLocaleString()} so'm, kerak: ${price.toLocaleString()} so'm`);
    return;
  }
  updateUserBalance(userId, -price);
  delete pendingOrders[orderId];
  await ctx.answerCbQuery('✅ Buyurtma tasdiqlandi!');
  await ctx.editMessageText(`${ctx.update.callback_query.message.text}\n\n✅ *Tasdiqlandi*`);
  try {
    await ctx.telegram.sendMessage(
      userId,
      `✅ Buyurtmangiz tasdiqlandi!\n\n💎 ${amount} Almaz tez orada UID: ${uid} ga tushiriladi.`
    );
  } catch (e) {}
});

// Kanal ma'lumotlari
const CHANNELS = [
  {
    username: process.env.CHANNEL_1_USERNAME?.replace('@', '') || 'channel1', // @ belgisini olib tashlaymiz
    link: process.env.CHANNEL_1_LINK || 'https://t.me/channel1'
  },
  {
    username: process.env.CHANNEL_2_USERNAME?.replace('@', '') || 'channel2', // @ belgisini olib tashlaymiz
    link: process.env.CHANNEL_2_LINK || 'https://t.me/channel2'
  }
];

// Xabarlarni boshqarish uchun asosiy funksiya
async function sendOrUpdateMenu(ctx, caption, keyboard) {
  const greeting = `Assalomu alaykum, ${ctx.from?.first_name || 'foydalanuvchi'}!\n\n`;
  
  try {
    // Loading animatsiyasini to'xtatish
    if (ctx.callbackQuery) {
      try {
        await ctx.answerCbQuery();
      } catch (e) {
        console.log('answerCbQuery xatoligi:', e.message);
      }
      
      // Agar asosiy menyu bo'lsa
      if (caption === 'Bo\'limni tanlang:') {
        try {
          // Avvalgi xabarni o'chirishga harakat qilamiz
          try {
            await ctx.deleteMessage();
          } catch (e) {
            console.log('Xabarni o\'chirib bo\'lmadi, yangi xabar yuborilmoqda...');
          }
          
          // Rasm bilan yangi xabar yuborishga harakat qilamiz
          try {
            await ctx.replyWithPhoto({ source: MENU_IMAGE }, {
              caption: greeting + caption,
              ...Markup.inlineKeyboard(keyboard),
              parse_mode: 'Markdown'
            });
            return;
          } catch (photoError) {
            console.error('Rasm bilan xabar yuborishda xatolik:', photoError);
            // Rasm bilan yuborib bo'lmasa, oddiy xabar sifatida yuborishga harakat qilamiz
            await ctx.reply(greeting + caption, {
              ...Markup.inlineKeyboard(keyboard),
              parse_mode: 'Markdown'
            });
          }
        } catch (error) {
          console.error('Asosiy menyu yuborishda xatolik:', error);
          // Xatolik yuz bersa, oddiy xabar sifatida yuborishga harakat qilamiz
          try {
            await ctx.reply(greeting + caption, {
              ...Markup.inlineKeyboard(keyboard),
              parse_mode: 'Markdown'
            });
          } catch (e) {
            console.error('Alternativ xabar yuborishda xatolik:', e);
          }
        }
      } else {
        // Boshqa menyular uchun mavjud xabarni tahrirlashga harakat qilamiz
        try {
          // Avvalgi xabarni tahrirlashga harakat qilamiz
          try {
            await ctx.editMessageText(caption, {
              ...Markup.inlineKeyboard(keyboard),
              parse_mode: 'Markdown'
            });
            return;
          } catch (editError) {
            console.error('Xabarni tahrirlashda xatolik:', editError);
            throw editError; // Keyingi catch blokiga o'tish uchun
          }
        } catch (e) {
          // Agar tahrirlab bo'lmasa, yangi xabar yuboramiz
          try {
            // Avvalgi xabarni o'chirishga harakat qilamiz (agar mavjud bo'lsa)
            try { 
              await ctx.deleteMessage(); 
            } catch (deleteError) {
              console.log('Eski xabarni o\'chirib bo\'lmadi:', deleteError.message);
            }
            
            // Yangi xabar yuboramiz
            await ctx.reply(caption, {
              ...Markup.inlineKeyboard(keyboard),
              parse_mode: 'Markdown'
            });
          } catch (sendError) {
            console.error('Yangi xabar yuborishda xatolik:', sendError);
            // Oxirgi chora sifatida, oddiy xabar yuborishga harakat qilamiz
            try {
              await ctx.reply(caption, Markup.inlineKeyboard(keyboard));
            } catch (finalError) {
              console.error('Yakuniy xabar yuborishda xatolik:', finalError);
            }
          }
        }
      }
    } else {
      // Yangi suhbat boshlanganda
      if (caption === 'Bo\'limni tanlang:') {
        try {
          const greeting = `Assalomu alaykum, ${ctx.from.first_name || 'foydalanuvchi'}!\n\n`;
          await ctx.replyWithPhoto({ source: MENU_IMAGE }, {
            caption: greeting + caption,
            ...Markup.inlineKeyboard(keyboard)
          });
        } catch (error) {
          console.error('Rasm yuklanmadi:', error);
          await ctx.reply(caption, Markup.inlineKeyboard(keyboard));
        }
      } else {
        await ctx.reply(caption, Markup.inlineKeyboard(keyboard));
      }
    }
  } catch (error) {
    console.error('Xatolik yuz berdi:', error);
  }
}

// Asosiy menyuda ko'rinadigan tugmalar nomlari
const MAIN_MENU = [
  'Hisobim',
  'Pul ishlash',
  'TG Premium & Stars',
  'Free Fire Almaz',
  'PUBG Mobile UC / PP',
  'UC Shop',
  'SOS',
  'Promokod',
  'Admen paneli',
];

// Referral tizimi uchun o'zgaruvchilar
const referrals = {}; // { referrerId: [referredUserIds] }
const REFERRAL_BONUS = 100; // Har bir taklif uchun beriladigan bonus

// /start yoki asosiy menyu ko'rsatish
async function sendMainMenu(ctx) {
  // Asosiy menyu tugmalarini yaratamiz
  try {
    // Avval obunani tekshirish
    const isSubscribed = await checkUserSubscription(ctx);
    
    // Agar obuna bo'lmagan bo'lsa, obuna bo'lish sahifasiga yo'naltiramiz
    if (!isSubscribed) {
      return await sendSubscriptionMessage(ctx);
    }
    
    // Agar obuna bo'lgan bo'lsa, asosiy menyuni ko'rsatamiz
    const menuItems = [...MAIN_MENU]; // Asl massivni o'zgartirmaslik uchun nusxalaymiz
  
    // Admin panelini faqat adminlar uchun ko'rsatamiz
    if (!isAdmin(ctx)) {
      const adminIndex = menuItems.indexOf('Admen paneli');
      if (adminIndex > -1) {
        menuItems.splice(adminIndex, 1);
      }
    }
    
    const keyboard = menuItems.map((text) => {
      if (text === 'UC Shop') {
        return [Markup.button.url(text, UC_CHANNEL_URL)];
      }
      return [Markup.button.callback(text, `menu:${text}`)];
    });
    
    // Agar obuna bo'lmagan bo'lsa, tekshirish tugmasini qo'shamiz
    if (!isSubscribed) {
      keyboard.push([Markup.button.callback('✅ Obunani tekshirish', 'check_subscription')]);
    }
    
    await sendOrUpdateMenu(ctx, 'Bo\'limni tanlang:', keyboard);
  } catch (error) {
    console.error('sendMainMenu xatosi:', error);
    await ctx.reply('Xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring.');
  }
};

bot.start((ctx) => {
  // Add user to our tracking set
  if (ctx.from && ctx.from.id) {
    global.botUsers.add(ctx.from.id);
  }
  // Faqat menyuni yuboramiz, qo'shimcha xabar yubormaymiz
  sendMainMenu(ctx);
});

// Inline tugma bosilganda
bot.action(/menu:(.+)/, async (ctx) => {
  const selection = ctx.match[1];

  switch (selection) {
    case 'Pul ishlash': {
      await ctx.answerCbQuery();
      // Referral link and stats
      const userId = ctx.from.id;
      const username = ctx.from.username || ctx.from.first_name || 'foydalanuvchi';
      // Hardcode bot username for short referral link
      const referralLink = `https://t.me/Tekin_akkaunt_ol_bot?start=ref${userId}`;
      const referralCount = referrals[userId] ? referrals[userId].length : 0;
      const totalEarned = referralCount * REFERRAL_BONUS;
      const message = `💰 *Pul ishlash* 💰\n\n` +
        `🔗 Sizning referal havolangiz:\n\`${referralLink}\`\n\n` +
        `👥 Sizning takliflaringiz: *${referralCount} ta*\n` +
        `💵 Jami ishlagan pulingiz: *${totalEarned} so'm*\n\n` +
        `📢 Do'stlaringizni taklif qiling va har bir taklif uchun *${REFERRAL_BONUS} so'm* oling!\n` +
        `Ular ham siz kabi pul ishlashni boshlaydilar!`;
      const keyboard = [
        [Markup.button.switchToChat('📤 Do\'stlarni taklif qilish', referralLink)],
        [Markup.button.callback('⬅️ Orqaga', 'back:main')]
      ];
      await ctx.reply(message, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(keyboard) });
      break;
    }

    case 'Hisobim':
      await sendAccountMenu(ctx);
      break;
    case 'TG Premium & Stars':
      // Avval asosiy menyuni ko'rsatamiz
      const mainKeyboard = [
        [Markup.button.callback('📱 Telegram Premium', 'premium:select')],
        [Markup.button.callback('⭐ Telegram Stars', 'stars:select')],
        [Markup.button.callback('⬅️ Orqaga', 'back:main')]
      ];
      await sendOrUpdateMenu(ctx, 'Qaysi xizmatni sotib olmoqchisiz?', mainKeyboard);
      break;
    case 'Free Fire Almaz': {
      await ctx.answerCbQuery();
      const price100 = ALMAZ_PRICES[100]?.toLocaleString() || 'Nomaʼlum';
      const keyboard = [
        [Markup.button.callback(`💎 Almaz sotib olish (100 Almaz - ${price100} so'm)`, 'buy:almaz')],
        [Markup.button.callback('⬅️ Orqaga', 'back:main')]
      ];
      await sendOrUpdateMenu(ctx, "💎 Almaz sotib olish bo'limi:", keyboard);
      break;
    }
    case 'PUBG Mobile UC / PP': {
      await ctx.answerCbQuery();
      const keyboard = [
        [Markup.button.callback('UC sotib olish', 'pubg:buy_uc')],
        [Markup.button.callback('PP sotib olish', 'pubg:buy_pp')],
        [Markup.button.callback('⬅️ Orqaga', 'back:main')]
      ];
      await sendOrUpdateMenu(ctx, "PUBG Mobile UC / PP bo'limi:", keyboard);
      break;
    }
    case 'UC Shop':
      await sendUCShop(ctx);
      break;
    case 'SOS':
      await sendSOS(ctx);
      break;
    case 'Promokod':
      await promptPromokod(ctx);
      break;
    case 'Admen paneli':
      if (isAdmin(ctx)) {
        await sendAdminPanel(ctx);
      } else {
        await ctx.answerCbQuery('Ruxsat yo\'q!');
      }
      break;
    default:
      await ctx.answerCbQuery('Ushbu bo\'lim hozircha mavjud emas');
  }
});

// PUBG Mobile UC sotib olish bosqichi
bot.action('pubg:buy_uc', async (ctx) => {
  await sendUcMenu(ctx);
});

// PUBG Mobile PP sotib olish bosqichi
bot.action('pubg:buy_pp', async (ctx) => {
  await sendPpMenu(ctx);
});

// UC paketini tanlash
bot.action(/pubg:uc:(\d+):(\d+)/, async (ctx) => {
  try {
    const userId = ctx.from.id;
    const userBalance = getUserBalance(userId);
    const amount = ctx.match[1];
    const price = parseInt(ctx.match[2]);
    
    // Check if user still has enough balance
    if (userBalance < price) {
      const neededAmount = price - userBalance;
      const minUcPrice = Math.min(...Object.values(UC_PRICES));
      
      const keyboard = [
        [Markup.button.callback('💳 Hisobni to\'ldirish', 'topup:amount')],
        [Markup.button.callback('⬅️ Orqaga', 'back:pubg')]
      ];
      
      return sendOrUpdateMenu(
        ctx,
        `⚠️ *Hisobingizda yetarli mablag' mavjud emas!*\n\n` +
        `💳 Sizning balansingiz: *${userBalance.toLocaleString()} so'm*\n` +
        `💰 Tanlangan paket narxi: *${price.toLocaleString()} so'm*\n` +
        `💵 Yetishmayotgan summa: *${neededAmount.toLocaleString()} so'm*\n\n` +
        `ℹ Eng arzon UC paketi: *${minUcPrice.toLocaleString()} so'm*\n` +
        `💡 Iltimos, hisobingizni to'ldiring yoki kichikroq miqdor tanlang.`,
        keyboard
      );
    }
    
    // If balance is sufficient, proceed with purchase
    ctx.session.buying = { type: 'pubg_uc', amount, price };
    
    await sendOrUpdateMenu(
      ctx,
      `💎 *${amount} UC* sotib olish uchun o'yindagi foydalanuvchi nomingizni yuboring:\n\n` +
      `💳 To'lov miqdori: *${price.toLocaleString()} so'm*\n` +
      `💰 Sizning balansingiz: *${userBalance.toLocaleString()} so'm*\n` +
      `📦 Miqdor: *${amount} UC*\n\n` +
      `ℹ Iltimos, o'yindagi to'liq foydalanuvchi nomingizni yozing.`,
      [[Markup.button.callback('⬅️ Orqaga', 'pubg:buy_uc')]]
    );
  } catch (error) {
    console.error('UC paketini tanlashda xatolik:', error);
    await ctx.reply('⚠️ Xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring.');
    return sendPubgMenu(ctx);
  }
});

// PP paketini tanlash
bot.action(/pubg:pp:(\d+):(\d+)/, async (ctx) => {
  try {
    const userId = ctx.from.id;
    const userBalance = getUserBalance(userId);
    const amount = ctx.match[1];
    const price = parseInt(ctx.match[2]);
    
    // Check if user still has enough balance
    if (userBalance < price) {
      const neededAmount = price - userBalance;
      const minPpPrice = Math.min(...Object.values(PP_PRICES));
      
      const keyboard = [
        [Markup.button.callback('💳 Hisobni to\'ldirish', 'topup:amount')],
        [Markup.button.callback('⬅️ Orqaga', 'back:pubg')]
      ];
      
      return sendOrUpdateMenu(
        ctx,
        `⚠️ *Hisobingizda yetarli mablag' mavjud emas!*\n\n` +
        `💳 Sizning balansingiz: *${userBalance.toLocaleString()} so'm*\n` +
        `💰 Tanlangan paket narxi: *${price.toLocaleString()} so'm*\n` +
        `💵 Yetishmayotgan summa: *${neededAmount.toLocaleString()} so'm*\n\n` +
        `ℹ Eng arzon PP paketi: *${minPpPrice.toLocaleString()} so'm*\n` +
        `💡 Iltimos, hisobingizni to'ldiring yoki kichikroq miqdor tanlang.`,
        keyboard
      );
    }
    
    // If balance is sufficient, proceed with purchase
    ctx.session.buying = { type: 'pubg_pp', amount, price };
    
    await sendOrUpdateMenu(
      ctx,
      `⭐ *${amount} PP* sotib olish uchun o'yindagi foydalanuvchi nomingizni yuboring:\n\n` +
      `💳 To'lov miqdori: *${price.toLocaleString()} so'm*\n` +
      `💰 Sizning balansingiz: *${userBalance.toLocaleString()} so'm*\n` +
      `📦 Miqdor: *${amount} PP*\n\n` +
      `ℹ Iltimos, o'yindagi to'liq foydalanuvchi nomingizni yozing.`,
      [[Markup.button.callback('⬅️ Orqaga', 'pubg:buy_pp')]]
    );
  } catch (error) {
    console.error('PP paketini tanlashda xatolik:', error);
  }
  
  await ctx.editMessageText(messageText, {
    reply_markup: { inline_keyboard: keyboard },
    parse_mode: 'Markdown'
  });
});

// Add channel flow
bot.action('admin:addChannel', async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.answerCbQuery('Ruxsat yo\'q!');
    return;
  }
  
  if (!ctx.session) ctx.session = {};
  ctx.session.channelAction = 'add';
  
  await ctx.editMessageText(
    '📢 *Yangi kanal qo\'shish*\n\n' +
    'Kanal username va linkini quyidagi formatda yuboring:\n' +
    '`@kanal_username https://t.me/kanal_link`\n\n' +
    'Misol uchun:\n' +
    '`@mychannel https://t.me/mychannel`\n\n' +
    '❕ *Eslatma:* Kanal usernamesi @ bilan boshlanishi kerak!',
    {
      reply_markup: {
        inline_keyboard: [
          [Markup.button.callback('◀️ Orqaga', 'admin:channelMenu')]
        ]
      },
      parse_mode: 'Markdown'
    }
  );
});


function sendPubgMenu(ctx) {
  const keyboard = [
    [Markup.button.callback('💎 UC Sotib Olish', 'pubg:buy_uc')],
    [Markup.button.callback('⭐ PP Sotib Olish', 'pubg:buy_pp')],
    [Markup.button.callback('⬅️ Orqaga', 'back:main')]
  ];
  return sendOrUpdateMenu(ctx, '🎮 PUBG Mobile - Xizmatlar', keyboard);
}

// UC sotib olish menyusi
async function sendUcMenu(ctx, customMessage = '') {
  const userId = ctx.from.id;
  const userBalance = getUserBalance(userId);
  const ucPrices = getUcPrices();
  
  // Show all packages without balance check
  const keyboard = [];
  
  // Add UC packages
  [60, 325, 660, 1800, 3850, 8100].forEach(uc => {
    const price = ucPrices[uc] || 0;
    if (price > 0) {
      const buttonText = `${uc} UC - ${price.toLocaleString()} so'm`;
      keyboard.push([
        Markup.button.callback(
          buttonText,
          `pubg:uc:${uc}:${price}`
        )
      ]);
    }
  });
  
  // Add back button
  keyboard.push([
    Markup.button.callback('⬅️ Orqaga', 'back:pubg')
  ]);
  
  // Prepare the message
  let message = `🎮 *PUBG Mobile UC Sotib Olish*\n\n`;
  message += `💳 UC paketlaridan birini tanlang:\n\n`;
  message += `💰 Sizning balansingiz: *${userBalance.toLocaleString()} so'm*\n\n`;
  
  if (customMessage) {
    message += `${customMessage}\n\n`;
  }
  
  return sendOrUpdateMenu(ctx, message, keyboard);
}

// PP sotib olish menyusi
async function sendPpMenu(ctx, customMessage = '') {
  const userId = ctx.from.id;
  const userBalance = getUserBalance(userId);
  const ppPrices = getPpPrices();
  
  // Show all packages without balance check
  const keyboard = [];
  
  // Add PP packages
  [50, 100, 200, 500, 1000, 2000, 3000, 5000, 10000, 20000, 50000, 100000].forEach(pp => {
    const price = ppPrices[pp] || 0;
    if (price > 0) {
      const buttonText = `${pp} PP - ${price.toLocaleString()} so'm`;
      keyboard.push([
        Markup.button.callback(
          buttonText,
          `pubg:pp:${pp}:${price}`
        )
      ]);
    }
  });
  
  // Add top-up and back buttons
  keyboard.push([
    Markup.button.callback('💳 Hisobni to\'ldirish', 'topup:amount')
  ]);
  keyboard.push([
    Markup.button.callback('⬅️ Orqaga', 'back:pubg')
  ]);
  
  // Prepare the message
  let message = `⭐ *PUBG Mobile PP Sotib Olish*\n\n`;
  message += `💰 Sizning balansingiz: *${userBalance.toLocaleString()} so'm*\n\n`;
  message += `💳 PP paketlaridan birini tanlang:\n`;
  
  // Add custom message if provided (like insufficient balance message)
  if (customMessage) {
    message = customMessage + '\n\n' + message;
  }
  
  return sendOrUpdateMenu(ctx, message, keyboard);
}

// Premium yoki Stars tanlash
bot.action('premium:select', async (ctx) => {
  const premiumPrices = getPremiumPrices();
  
  const keyboard = [
    // Premium narxlari
    [Markup.button.callback(`📱 1 oy - ${premiumPrices[1].toLocaleString()} so'm`, `buy:premium:1:${premiumPrices[1]}`)],
    [Markup.button.callback(`📱 3 oy - ${premiumPrices[3].toLocaleString()} so'm`, `buy:premium:3:${premiumPrices[3]}`)],
    [Markup.button.callback(`📱 6 oy - ${premiumPrices[6].toLocaleString()} so'm`, `buy:premium:6:${premiumPrices[6]}`)],
    [Markup.button.callback(`📱 12 oy - ${premiumPrices[12].toLocaleString()} so'm`, `buy:premium:12:${premiumPrices[12]}`)],
    // Orqaga tugmasi
    [Markup.button.callback('⬅️ Orqaga', 'back:premium_stars')]
  ];
  
  try {
    await sendOrUpdateMenu(ctx, '📱 Telegram Premium narxlari:', keyboard);
  } catch (error) {
    console.error('Error sending premium menu:', error);
    await ctx.reply('Xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring.');
  }
});

// Stars narxlarini ko'rsatamiz
bot.action('stars:select', async (ctx) => {
  const starsPrices = getStarsPrices();
  
  const keyboard = [
    // Stars narxlari
    [Markup.button.callback(`⭐ 100 Stars - ${starsPrices[100].toLocaleString()} so'm`, `buy:stars:100:${starsPrices[100]}`)],
    [Markup.button.callback(`⭐ 200 Stars - ${starsPrices[200].toLocaleString()} so'm`, `buy:stars:200:${starsPrices[200]}`)],
    [Markup.button.callback(`⭐ 500 Stars - ${starsPrices[500].toLocaleString()} so'm`, `buy:stars:500:${starsPrices[500]}`)],
    [Markup.button.callback(`⭐ 1000 Stars - ${starsPrices[1000].toLocaleString()} so'm`, `buy:stars:1000:${starsPrices[1000]}`)],
    // Orqaga tugmasi
    [Markup.button.callback('⬅️ Orqaga', 'back:premium_stars')]
  ];
  
  try {
    await sendOrUpdateMenu(ctx, '⭐ Telegram Stars narxlari:', keyboard);
  } catch (error) {
    console.error('Error sending stars menu:', error);
    await ctx.reply('Xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring.');
  }
});

// Hisobim kichik menyusi
async function sendAccountMenu(ctx) {
  const userId = ctx.from.id;
  const balance = await getUserBalance(ctx.from.id);
  
  const keyboard = [
    [Markup.button.callback('💰 Balansni to\'ldirish', 'topup:amount')],
    [Markup.button.callback('⬅️ Orqaga', 'back:main')]
  ];
  await sendOrUpdateMenu(ctx, `💳 Balansingiz: ${balance.toLocaleString()} so'm`, keyboard);
  await ctx.answerCbQuery();
}

// --- Sozlamalar ---
const UC_CHANNEL_URL = 'https://t.me/suxa_cyber';
const ADMIN_USER = '@suxacyber';
const ADMIN_IDS = [5735723011]; // admin ID lari

// Track all users who have started the bot
if (!global.botUsers) {
  global.botUsers = new Set();
}

// Premium va Stars narxlari
const PREMIUM_PRICES = {
  1: 50000,  // 1 oy
  3: 120000, // 3 oy
  6: 200000, // 6 oy
  12: 350000 // 12 oy
};

const STARS_PRICES = {
  100: 10000,
  200: 19000,
  500: 45000,
  1000: 85000
};

// Bitta rasm fayl nomi (rasmni papkaga yuklab qo'ying)
const MENU_IMAGE = 'menu.jpg'; // rasm fayl nomi

// Foydalanuvchilar balansi (aslida bu ma'lumotlar bazasida saqlanishi kerak)
const userBalances = {};

// Buyurtma yaratish uchun handler
bot.action(/buy:(premium|stars):(\d+):(\d+)/, async (ctx) => {
  const type = ctx.match[1]; // 'premium' yoki 'stars'
  const amount = parseInt(ctx.match[2]); // oylik miqdor yoki stars miqdori
  const price = parseInt(ctx.match[3]); // narx
  const userId = ctx.from.id;
  
  // Foydalanuvchi balansini tekshirish
  const userBalance = getUserBalance(userId);
  
  // Agar balans yetarli bo'lsa
  if (userBalance >= price) {
    // Sessiyada saqlaymiz
    ctx.session.buying = { type, amount, price };
    
    // Foydalanuvchidan username so'raymiz
    await sendOrUpdateMenu(
      ctx,
      `✅ Sotib olish uchun Telegram usernamingizni kiriting:\n` +
      `📦 Mahsulot: ${type === 'premium' ? 'Telegram Premium' : 'Telegram Stars'}\n` +
      `🔢 Miqdor: ${amount} ${type === 'premium' ? 'oy' : 'stars'}\n` +
      `💰 Narxi: ${price.toLocaleString()} so'm\n\n` +
      `Iltimos, shu formatda yuboring: @username`,
      [[Markup.button.callback('❌ Bekor qilish', 'back:main')]]
    );
  } else {
    // Balans yetarli emas
    const needed = price - userBalance;
    await sendOrUpdateMenu(
      ctx,
      `❌ *Balansingizda yetarli mablag' yo'q!*\n\n` +
      `💳 Joriy balans: ${userBalance.toLocaleString()} so'm\n` +
      `💰 Kerak bo'lgan summa: ${price.toLocaleString()} so'm\n` +
      `📉 Yetishmayapti: ${needed.toLocaleString()} so'm\n\n` +
      `Iltimos, balansingizni to'ldiring va qayta urinib ko'ring.`,
      [
        [Markup.button.callback('💳 Balansni to\'ldirish', 'topup:amount')],
        [Markup.button.callback('🔄 Qayta urinish', `back:${type === 'premium' ? 'premium' : 'stars'}`)]
      ],
      { parse_mode: 'Markdown' }
    );
  }
});

// Tasdiqlash uchun buyurtmalar
const pendingOrders = {}; // { orderId: { userId, type, amount, username, price } }

// Tasodifiy buyurtma ID generatsiya qilish
function generateOrderId() {
  return Math.random().toString(36).substr(2, 9);
}

// Foydalanuvchi balansini olish
function getUserBalance(userId) {
  return userBalances[userId] || 0;
}

// Foydalanuvchi balansini yangilash
function updateUserBalance(userId, amount) {
  if (!userBalances[userId]) {
    userBalances[userId] = 0;
  }
  userBalances[userId] += amount;
  return userBalances[userId];
}

// ---------- Pul ishlash (Earn Money) ----------
async function sendEarnMoneyMenu(ctx) {
  try {
    const userId = ctx.from.id;
    const username = ctx.from.username || ctx.from.first_name || 'foydalanuvchi';
    
    // Hardcode bot username for short referral link
    const referralLink = `https://t.me/Tekin_akkaunt_ol_bot?start=ref${userId}`;
    
    // Get referral stats
    const referralCount = referrals[userId] ? referrals[userId].length : 0;
    const totalEarned = referralCount * REFERRAL_BONUS;
    
    const message = `💰 *Pul ishlash* 💰\n\n` +
      `🔗 Sizning referal havolangiz:\n\`${referralLink}\`\n\n` +
      `👥 Sizning takliflaringiz: *${referralCount} ta*\n` +
      `💵 Jami ishlagan pulingiz: *${totalEarned} so'm*\n\n` +
      `📢 Do'stlaringizni taklif qiling va har bir taklif uchun *${REFERRAL_BONUS} so'm* oling!\n` +
      `Ular ham siz kabi pul ishlashni boshlaydilar!`;
    
    const keyboard = [
      [Markup.button.switchToChat('📤 Do\'stlarni taklif qilish', '')],
      [Markup.button.callback('🔄 Referal havolani yangilash', 'refresh_referral')],
      [Markup.button.callback('⬅️ Orqaga', 'back:main')]
    ];
    
    // Try to edit the message, if that fails, send a new one
    try {
      if (ctx.callbackQuery) {
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard(keyboard)
        });
      } else {
        await ctx.reply(message, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard(keyboard)
        });
      }
    } catch (error) {
      console.error('Error editing/sending message:', error);
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(keyboard)
      });
    }
  } catch (error) {
    console.error('Error in sendEarnMoneyMenu:', error);
    await ctx.reply('Xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring.', {
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Orqaga', 'back:main')]
      ])
    });
  }
}

// Handle start with referral
const handleReferral = (ctx) => {
  const startPayload = ctx.message?.text?.split(' ')[1];
  if (!startPayload || !startPayload.startsWith('ref')) return;
  
  const referrerId = parseInt(startPayload.replace('ref', ''));
  const userId = ctx.from.id;
  
  // Don't count if user is referring themselves
  if (referrerId === userId) return;
  
  // Initialize referrer's array if it doesn't exist
  if (!referrals[referrerId]) {
    referrals[referrerId] = [];
  }
  
  // Check if user was already referred
  if (!referrals[referrerId].includes(userId)) {
    referrals[referrerId].push(userId);
    updateUserBalance(referrerId, REFERRAL_BONUS);
    
    // Notify referrer
    ctx.telegram.sendMessage(
      referrerId,
      `🎉 Sizning taklifingiz orqali yangi foydalanuvchi qo'shildi!\n` +
      `💵 Hisobingizga ${REFERRAL_BONUS} so'm qo'shildi.`
    ).catch(console.error);
  }
};

// Add referral handler to start command
bot.start((ctx) => {
  handleReferral(ctx);
  sendMainMenu(ctx);
});

// Promo kodni qo'llash
bot.command('promo', async (ctx) => {
  const args = ctx.message.text.split(' ');
  if (args.length !== 2) {
    await ctx.reply('❌ Noto\'g\'ri buyruq. Iltimos, quyidagi ko\'rinishda kiriting:\n`/promo KOD`', { parse_mode: 'Markdown' });
    return;
  }

  const promoCode = args[1].toUpperCase();
  const promoData = promoCodeStorage.get(promoCode);
  const userId = ctx.from.id;

  if (!promoData) {
    await ctx.reply('❌ Noto\'g\'ri promo kod!');
    return;
  }

  // Check if user already used this promo
  if (promoData.usedBy && promoData.usedBy.includes(userId)) {
    await ctx.reply('⚠️ Siz ushbu promokoddan foydalangansiz!');
    return;
  }

  // Check if promo code has uses left
  if (promoData.usedBy && promoData.usedBy.length >= promoData.uses) {
    await ctx.reply('❌ Ushbu promokodning limiti tugagan!');
    return;
  }

  // Apply promo code
  if (!promoData.usedBy) {
    promoData.usedBy = [];
  }
  promoData.usedBy.push(userId);
  updateUserBalance(userId, promoData.amount);
  promoCodeStorage.set(promoCode, promoData);

  await ctx.reply(
    `✅ Promo kod muvaffaqiyatli qo\'llandi!\n` +
    `💰 Sizning hisobingizga *${promoData.amount}* so'm qo\'shildi.`,
    { parse_mode: 'Markdown' }
  );
});

// Handle menu items
bot.action(/^menu:(.+)$/, async (ctx) => {
  const menuItem = ctx.match[1];
  
  switch(menuItem) {
    case 'Pul ishlash':
      await ctx.answerCbQuery();
      await sendEarnMoneyMenu(ctx);
      break;
    case 'Hisobim':
      await ctx.answerCbQuery();
      await sendAccountMenu(ctx);
      break;
    case 'TG Premium & Stars':
      await ctx.answerCbQuery();
      // ...existing code...
      break;
    case 'Free Fire Almaz': {
      await ctx.answerCbQuery();
      const keyboard = [
        [Markup.button.callback('💎 Almaz sotib olish', 'buy:almaz')],
        [Markup.button.callback('⬅️ Orqaga', 'back:main')]
      ];
      await sendOrUpdateMenu(ctx, "💎 Almaz sotib olish bo'limi:", keyboard);
      break;
    }
    case 'PUBG Mobile UC / PP': {
      await ctx.answerCbQuery();
      const keyboard = [
        [Markup.button.callback('UC sotib olish', 'pubg:buy_uc')],
        [Markup.button.callback('PP sotib olish', 'pubg:buy_pp')],
        [Markup.button.callback('⬅️ Orqaga', 'back:main')]
      ];
      await sendOrUpdateMenu(ctx, "PUBG Mobile UC / PP bo'limi:", keyboard);
      break;
    }
    case 'UC Shop':
      await ctx.answerCbQuery();
      await sendUCShop(ctx);
      break;
    case 'SOS':
      await ctx.answerCbQuery();
      await sendSOS(ctx);
      break;
    case 'Promokod':
      await ctx.answerCbQuery();
      await promptPromokod(ctx);
      break;
    case 'Admen paneli':
      if (isAdmin(ctx)) {
        await sendAdminPanel(ctx);
      } else {
        await ctx.answerCbQuery('Ruxsat yo\'q!');
      }
      break;
    default:
      await ctx.answerCbQuery('Ushbu bo\'lim hozircha mavjud emas');
  }
});

// Handle refresh referral link
bot.action('refresh_referral', async (ctx) => {
  await ctx.answerCbQuery('Referal havola yangilandi!');
  await sendEarnMoneyMenu(ctx);
});

// Handle back button
bot.action(/^back:(.+)/, async (ctx) => {
  const target = ctx.match[1];
  
  try {
    switch (target) {
      case 'main':
        await sendMainMenu(ctx);
        break;
      case 'backToMain':
        await sendAdminPanel(ctx);
        return;
      case 'admin':
        await sendAdminPanel(ctx);
        break;
      case 'findUser':
        // Reset find user state
        if (ctx.session.awaitingFindUser) {
          ctx.session.awaitingFindUser = false;
        }
        await sendAdminPanel(ctx);
        break;
      default:
        // Default back to main menu
        await sendMainMenu(ctx);
    }
    
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Back button error:', error);
    try {
      await ctx.answerCbQuery('Xatolik yuz berdi!');
      await sendMainMenu(ctx);
    } catch (e) {
      console.error('Error in error handler:', e);
    }
  }
});

// In-memory storage for promo codes
const promoCodeStorage = new Map();

// Generate a random promo code
function generatePromoCode(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Check if promo code is valid
async function checkPromoCode(code) {
  const promo = promoCodeStorage.get(code);
  if (!promo) {
    return { valid: false, message: '❌ Noto\'g\'ri promokod!' };
  }
  if (promo.used) {
    return { valid: false, message: '❌ Ushbu promokod allaqachon ishlatilgan!' };
  }
  if (promo.expiresAt && new Date() > new Date(promo.expiresAt)) {
    return { valid: false, message: '❌ Ushbu promokodning muddati o`tgan!' };
  }
  if (promo.usesLeft <= 0) {
    return { valid: false, message: '❌ Ushbu promokodning barcha imkoniyatlari tugagan!' };
  }
  return { 
    valid: true, 
    amount: promo.amount, 
    message: `✅ Promokod qabul qilindi! Sizning hisobingizga ${promo.amount} so'm qo'shildi.` 
  };
}

// Mark promo code as used
function markPromoCodeAsUsed(code, userId) {
  const promo = promoCodeStorage.get(code);
  if (promo) {
    if (!promo.usedBy) {
      promo.usedBy = [];
    }
    if (!promo.usedBy.includes(userId)) {
      promo.usedBy.push(userId);
      promo.usesLeft--;
      if (promo.usesLeft <= 0) {
        promo.used = true;
      }
      return true;
    }
  }
  return false;
}

// ---------- Admin Panel helpers ----------
function isAdmin(ctx) {
  return ADMIN_IDS.includes(ctx.from.id);
}

async function sendAdminPanel(ctx) {
  try {
    if (!isAdmin(ctx)) {
      if (ctx.answerCbQuery) {
        try {
          await ctx.answerCbQuery('Ruxsat yo\'q').catch(e => console.log('answerCbQuery error:', e.message));
        } catch (e) {
          console.log('answerCbQuery error:', e.message);
        }
      }
      return;
    }
    
    const channels = getChannels();
    const channelInfo = channels.length > 0 
      ? `\n📢 Joriy kanallar: ${channels.length} ta`
      : '\n⚠️ Hozircha kanallar qo\'shilmagan';
    
    // answerCbQuery ni try-catch ichiga olamiz
    if (ctx.answerCbQuery) {
      try {
        await ctx.answerCbQuery().catch(e => console.log('answerCbQuery error:', e.message));
      } catch (e) {
        console.log('answerCbQuery error:', e.message);
      }
    }
    
    const keyboard = [
      [Markup.button.callback('💳 Karta ma\'lumotlari', 'admin:cardMenu')],
      [Markup.button.callback('💰 Narxlarni o\'zgartirish', 'admin:priceMenu')],
      [Markup.button.callback('🎫 Promokod yaratish', 'admin:createPromo')],
      [Markup.button.callback('📢 Xabar yuborish', 'admin:broadcast')],
      [Markup.button.callback('📊 Statistika', 'admin:stats')],
      [Markup.button.callback('🔙 Asosiy menyu', 'back:main')]
    ];

    const messageText = '👨\u200d💻 *Admin paneli*' +
      channelInfo +
      '\n\nQuyidagi bo\'limlardan birini tanlang:';

    // Agar xabarda rasm bo'lsa, yangi xabar yuboramiz
    if (ctx.update.callback_query?.message?.photo) {
      try {
        await ctx.reply(messageText, {
          reply_markup: { inline_keyboard: keyboard },
          parse_mode: 'Markdown'
        });
        // Eski xabarni o'chiramiz
        try {
          await ctx.deleteMessage();
        } catch (e) {
          console.log('Eski xabarni o\'chirib bo\'lmadi:', e.message);
        }
      } catch (e) {
        console.error('Yangi xabar yuborishda xatolik:', e.message);
      }
    } else {
      // Oddiy xabarni tahrirlaymiz
      try {
        await ctx.editMessageText(messageText, {
          reply_markup: { inline_keyboard: keyboard },
          parse_mode: 'Markdown'
        });
      } catch (e) {
        console.error('Xabarni tahrirlashda xatolik:', e.message);
        // Tahrirlab bo'lmasa, yangi xabar sifatida yuboramiz
        try {
          await ctx.reply(messageText, {
            reply_markup: { inline_keyboard: keyboard },
            parse_mode: 'Markdown'
          });
        } catch (e) {
          console.error('Yangi xabar yuborishda xatolik (2):', e.message);
        }
      }
    }
  } catch (error) {
    console.error('sendAdminPanel xatolik:', error.message);
  }
}

// Handle promo code uses selection
bot.action(/^setPromoUses:(\d+)$/, async (ctx) => {
  if (!isAdmin(ctx) || !ctx.session.creatingPromo) {
    await ctx.answerCbQuery('Xatolik!');
    return;
  }
  
  const uses = parseInt(ctx.match[1]);
  ctx.session.creatingPromo.data.uses = uses;
  ctx.session.creatingPromo.step = 'expiry';
  
  await sendOrUpdateMenu(
    ctx,
    `🔄 *Foydalanishlar soni: ${uses} marta*\n\n` +
    `📅 Promo kod qancha kunga amal qiladi?\n` +
    `Iltimos, muddatni kiriting yoki tanlang:`, 
    [
      [Markup.button.callback('1 kun', 'setPromoExpiry:1')],
      [Markup.button.callback('7 kun', 'setPromoExpiry:7')],
      [Markup.button.callback('30 kun', 'setPromoExpiry:30')],
      [Markup.button.callback('◀️ Orqaga', 'admin:promoMenu')]
    ],
    { parse_mode: 'Markdown' }
  );
});

// Handle promo code expiry selection
bot.action(/^setPromoExpiry:(\d+)$/, async (ctx) => {
  if (!isAdmin(ctx) || !ctx.session.creatingPromo) {
    await ctx.answerCbQuery('Xatolik!');
    return;
  }
  
  const days = parseInt(ctx.match[1]);
  const { amount, uses } = ctx.session.creatingPromo.data;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);
  
  await sendOrUpdateMenu(
    ctx,
    `✅ *Promo kod ma'lumotlari*\n\n` +
    `💰 Summa: *${amount.toLocaleString()} so'm*\n` +
    `🔄 Foydalanish: *${uses} marta*\n` +
    `📆 Amal qilish muddati: *${days} kun*\n` +
    `📅 Tugash sanasi: *${expiresAt.toLocaleDateString()}*\n\n` +
    `Promo kodni yaratishni tasdiqlaysizmi?`,
    [
      [Markup.button.callback('✅ Tasdiqlash', 'admin:confirmPromo')],
      [Markup.button.callback('❌ Bekor qilish', 'admin:promoMenu')]
    ],
    { parse_mode: 'Markdown' }
  );
});

// Handle admin message to user callback
bot.action(/admin:message_user:(\d+):(\d+)/, async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.answerCbQuery('Ruxsat yo\'q');
    return;
  }
  
  const targetUserId = ctx.match[1];
  const adminId = ctx.match[2];
  
  // Only the admin who initiated the search can send messages
  if (ctx.from.id.toString() !== adminId) {
    await ctx.answerCbQuery('Faqat o\'zingiz qidirgan foydalanuvchiga xabar yuborishingiz mumkin');
    return;
  }
  
  // Store the target user ID in session
  ctx.session.messageTargetUser = targetUserId;
  
  // Ask for the message to send
  await ctx.answerCbQuery();
  await sendOrUpdateMenu(
    ctx,
    '✉️ Foydalanuvchiga yubormoqchi bo\'lgan xabaringizni yuboring:',
    [[Markup.button.callback('❌ Bekor qilish', 'admin:findUser')]]
  );
  
  // Set flag to indicate we're waiting for a message
  ctx.session.awaitingUserMessage = true;
});



// Stars narxlari
bot.action('admin:starsPrices', async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.answerCbQuery('Ruxsat yo\'q!');
    return;
  }
  
  const starsPrices = getStarsPrices();
  let starsText = '⭐ *Stars Narxlari*\n\n';
  
  for (const [amount, price] of Object.entries(starsPrices)) {
    starsText += `🔹 ${amount} ta: ${price.toLocaleString()} so'm\n`;
  }
  
  const keyboard = [
    [Markup.button.callback('✏️ 100 ta', 'admin:editPrice:stars:100')],
    [Markup.button.callback('✏️ 200 ta', 'admin:editPrice:stars:200')],
    [Markup.button.callback('✏️ 500 ta', 'admin:editPrice:stars:500')],
    [Markup.button.callback('✏️ 1000 ta', 'admin:editPrice:stars:1000')],
    [Markup.button.callback('◀️ Orqaga', 'admin:priceMenu')]
  ];
  
  await sendOrUpdateMenu(ctx, starsText, keyboard, { parse_mode: 'Markdown' });
});

bot.action('admin:editPremium', async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.answerCbQuery('Ruxsat yo\'q!');
    return;
  }
  
  const premiumPrices = getPremiumPrices();
  let premiumText = '🎖️ *Premium Narxlari*\n\n';
  
  for (const [months, price] of Object.entries(premiumPrices)) {
    premiumText += `🔹 ${months} oy: ${price.toLocaleString()} so'm\n`;
  }
  
  const keyboard = [
    [Markup.button.callback('✏️ 1 oy', 'admin:editPrice:premium:1')],
    [Markup.button.callback('✏️ 3 oy', 'admin:editPrice:premium:3')],
    [Markup.button.callback('✏️ 6 oy', 'admin:editPrice:premium:6')],
    [Markup.button.callback('✏️ 12 oy', 'admin:editPrice:premium:12')],
    [Markup.button.callback('◀️ Orqaga', 'admin:priceMenu')]
  ];
  
  await ctx.editMessageText(premiumText, {
    reply_markup: { inline_keyboard: keyboard },
    parse_mode: 'Markdown'
  });
});

// Handle Stars price editing
// Handle back to main admin menu
bot.action('admin:backToMain', async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.answerCbQuery('Ruxsat yo\'q!');
    return;
  }
  
  const channels = getChannels();
  const channelInfo = channels.length > 0 
    ? `\n📢 Joriy kanallar: ${channels.length} ta`
    : '\n⚠️ Hozircha kanallar qo\'shilmagan';
  
  const keyboard = [
    [Markup.button.callback('💳 Karta ma\'lumotlari', 'admin:cardMenu')],
    [Markup.button.callback('💰 Narxlarni o\'zgartirish', 'admin:priceMenu')],
    [Markup.button.callback('🎫 Promokod yaratish', 'admin:createPromo')],
    [Markup.button.callback('📢 Xabar yuborish', 'admin:broadcast')],
    [Markup.button.callback('📊 Statistika', 'admin:stats')],
    [Markup.button.callback('🔙 Asosiy menyu', 'back:main')]
  ];

  const messageText = '👨\u200d💻 *Admin paneli*' +
    channelInfo +
    '\n\nQuyidagi bo\'limlardan birini tanlang:';

  try {
    await ctx.editMessageText(messageText, {
      reply_markup: { inline_keyboard: keyboard },
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('Error in backToMain:', error);
    await ctx.reply(messageText, {
      reply_markup: { inline_keyboard: keyboard },
      parse_mode: 'Markdown'
    });
  }
});

// Handle Stars price editing
bot.action('admin:editStars', async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.answerCbQuery('Ruxsat yo\'q!');
    return;
  }
  
  const starsPrices = getStarsPrices();
  let starsText = '⭐ *Stars Narxlari*\n\n';
  
  for (const [count, price] of Object.entries(starsPrices)) {
    starsText += `🔹 ${count} ta: ${price.toLocaleString()} so'm\n`;
  }
  
  const keyboard = [
    [Markup.button.callback('✏️ 100 Stars', 'admin:editPrice:stars:100')],
    [Markup.button.callback('✏️ 200 Stars', 'admin:editPrice:stars:200')],
    [Markup.button.callback('✏️ 500 Stars', 'admin:editPrice:stars:500')],
    [Markup.button.callback('✏️ 1000 Stars', 'admin:editPrice:stars:1000')],
    [Markup.button.callback('◀️ Orqaga', 'admin:priceMenu')]
  ];
  
  await ctx.editMessageText(starsText, {
    reply_markup: { inline_keyboard: keyboard },
    parse_mode: 'Markdown'
  });
});

// Handle stars price editing
bot.action(/admin:editPrice:stars:(\d+)/, async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.answerCbQuery('Ruxsat yo\'q!');
    return;
  }
  
  const count = ctx.match[1];
  const currentPrice = getStarsPrices()[count] || 0;
  
  ctx.session.editingStarsPrice = { count };
  
  try {
    await ctx.editMessageText(
      `⭐ *${count} Stars narxini o'zgartirish*\n\n` +
      `Joriy narx: *${currentPrice.toLocaleString()} so'm*\n\n` +
      `Yangi narxni so'mda yuboring (faqat raqamlar):`,
      {
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback('❌ Bekor qilish', 'admin:editStars')]
          ]
        },
        parse_mode: 'Markdown'
      }
    );
  } catch (error) {
    console.error('Error editing message:', error);
    await ctx.reply(
      `⭐ *${count} Stars narxini o'zgartirish*\n\n` +
      `Joriy narx: *${currentPrice.toLocaleString()} so'm*\n\n` +
      `Yangi narxni so'mda yuboring (faqat raqamlar):`,
      {
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback('❌ Bekor qilish', 'admin:editStars')]
          ]
        },
        parse_mode: 'Markdown'
      }
    );
  }
});

// Handle UC price editing
bot.action('admin:editUc', async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.answerCbQuery('Ruxsat yo\'q!');
    return;
  }
  
  const ucPrices = getUcPrices();
  let ucText = '🎮 *PUBG Mobile UC Narxlari*\n\n';
  
  for (const [amount, price] of Object.entries(ucPrices)) {
    ucText += `🔹 ${amount} UC: ${price.toLocaleString()} so'm\n`;
  }
  
  const keyboard = [
    [Markup.button.callback('✏️ 60 UC', 'admin:editPrice:uc:60')],
    [Markup.button.callback('✏️ 325 UC', 'admin:editPrice:uc:325')],
    [Markup.button.callback('✏️ 660 UC', 'admin:editPrice:uc:660')],
    [Markup.button.callback('✏️ 1800 UC', 'admin:editPrice:uc:1800')],
    [Markup.button.callback('✏️ 3850 UC', 'admin:editPrice:uc:3850')],
    [Markup.button.callback('✏️ 8100 UC', 'admin:editPrice:uc:8100')],
    [Markup.button.callback('◀️ Orqaga', 'admin:priceMenu')]
  ];
  
  try {
    await ctx.editMessageText(ucText, {
      reply_markup: { inline_keyboard: keyboard },
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('Error editing message:', error);
    await ctx.reply(ucText, {
      reply_markup: { inline_keyboard: keyboard },
      parse_mode: 'Markdown'
    });
  }
});

// Handle UC price item editing
bot.action(/admin:editPrice:uc:(\d+)/, async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.answerCbQuery('Ruxsat yo\'q!');
    return;
  }
  
  const amount = ctx.match[1];
  const currentPrice = getUcPrices()[amount] || 0;
  
  ctx.session.editingUcPrice = { amount };
  
  try {
    await ctx.editMessageText(
      `🎮 *${amount} UC narxini o'zgartirish*\n\n` +
      `Joriy narx: *${currentPrice.toLocaleString()} so'm*\n\n` +
      `Yangi narxni so'mda yuboring (faqat raqamlar):`,
      {
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback('❌ Bekor qilish', 'admin:editUc')]
          ]
        },
        parse_mode: 'Markdown'
      }
    );
  } catch (error) {
    console.error('Error editing message:', error);
    await ctx.reply(
      `🎮 *${amount} UC narxini o'zgartirish*\n\n` +
      `Joriy narx: *${currentPrice.toLocaleString()} so'm*\n\n` +
      `Yangi narxni so'mda yuboring (faqat raqamlar):`,
      {
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback('❌ Bekor qilish', 'admin:editUc')]
          ]
        },
        parse_mode: 'Markdown'
      }
    );
  }
});

// Handle Free Fire price editing
bot.action('admin:editFf', async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.answerCbQuery('Ruxsat yo\'q!');
    return;
  }
  
  const ffPrices = getFfPrices();
  let ffText = '🔥 *Free Fire Diamond Narxlari*\n\n';
  
  for (const [count, price] of Object.entries(ffPrices)) {
    ffText += `🔹 ${count} Diamond: ${price.toLocaleString()} so'm\n`;
  }
  
  const keyboard = [
    [Markup.button.callback('✏️ 100 Diamond', 'admin:editPrice:ff:100')],
    [Markup.button.callback('✏️ 200 Diamond', 'admin:editPrice:ff:200')],
    [Markup.button.callback('✏️ 500 Diamond', 'admin:editPrice:ff:500')],
    [Markup.button.callback('✏️ 1000 Diamond', 'admin:editPrice:ff:1000')],
    [Markup.button.callback('✏️ 2000 Diamond', 'admin:editPrice:ff:2000')],
    [Markup.button.callback('◀️ Orqaga', 'admin:priceMenu')]
  ];
  
  try {
    await ctx.editMessageText(ffText, {
      reply_markup: { inline_keyboard: keyboard },
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('Error editing message:', error);
    await ctx.reply(ffText, {
      reply_markup: { inline_keyboard: keyboard },
      parse_mode: 'Markdown'
    });
  }
});

// Handle PP price menu
bot.action('admin:editPp', async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.answerCbQuery('Ruxsat yo\'q!');
    return;
  }
  
  const ppPrices = getPpPrices();
  let ppText = '🎯 *PUBG Mobile PP Narxlari*\n\n';
  
  for (const [amount, price] of Object.entries(ppPrices)) {
    ppText += `🔹 ${amount} PP: ${price.toLocaleString()} so'm\n`;
  }
  
  const keyboard = [
    [Markup.button.callback('✏️ 50 PP', 'admin:editPrice:pp:50')],
    [Markup.button.callback('✏️ 100 PP', 'admin:editPrice:pp:100')],
    [Markup.button.callback('✏️ 200 PP', 'admin:editPrice:pp:200')],
    [Markup.button.callback('✏️ 500 PP', 'admin:editPrice:pp:500')],
    [Markup.button.callback('✏️ 1000 PP', 'admin:editPrice:pp:1000')],
    [Markup.button.callback('✏️ 2000 PP', 'admin:editPrice:pp:2000')],
    [Markup.button.callback('✏️ 3000 PP', 'admin:editPrice:pp:3000')],
    [Markup.button.callback('✏️ 5000 PP', 'admin:editPrice:pp:5000')],
    [Markup.button.callback('✏️ 10000 PP', 'admin:editPrice:pp:10000')],
    [Markup.button.callback('✏️ 20000 PP', 'admin:editPrice:pp:20000')],
    [Markup.button.callback('✏️ 50000 PP', 'admin:editPrice:pp:50000')],
    [Markup.button.callback('✏️ 100000 PP', 'admin:editPrice:pp:100000')],
    [Markup.button.callback('◀️ Orqaga', 'admin:priceMenu')]
  ];
  
  try {
    await ctx.editMessageText(ppText, {
      reply_markup: { inline_keyboard: keyboard },
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('Error editing message:', error);
    await ctx.reply(ppText, {
      reply_markup: { inline_keyboard: keyboard },
      parse_mode: 'Markdown'
    });
  }
});

// Handle PP price item editing
bot.action(/admin:editPrice:pp:(\d+)/, async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.answerCbQuery('Ruxsat yo\'q!');
    return;
  }
  
  const amount = ctx.match[1];
  const currentPrice = getPpPrices()[amount] || 0;
  
  ctx.session.editingPpPrice = { amount };
  
  try {
    await ctx.editMessageText(
      `🎯 *${amount} PP narxini o'zgartirish*\n\n` +
      `Joriy narx: *${currentPrice.toLocaleString()} so'm*\n\n` +
      `Yangi narxni so'mda yuboring (faqat raqamlar):`,
      {
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback('❌ Bekor qilish', 'admin:editPp')]
          ]
        },
        parse_mode: 'Markdown'
      }
    );
  } catch (error) {
    console.error('Error editing message:', error);
    await ctx.reply(
      `🎯 *${amount} PP narxini o'zgartirish*\n\n` +
      `Joriy narx: *${currentPrice.toLocaleString()} so'm*\n\n` +
      `Yangi narxni so'mda yuboring (faqat raqamlar):`,
      {
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback('❌ Bekor qilish', 'admin:editPp')]
          ]
        },
        parse_mode: 'Markdown'
      }
    );
  }
});

// Handle UC price menu
bot.action('admin:editUc', async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.answerCbQuery('Ruxsat yo\'q!');
    return;
  }
  
  const ucPrices = getUcPrices();
  let ucText = '🎮 *PUBG Mobile UC Narxlari*\n\n';
  
  for (const [amount, price] of Object.entries(ucPrices)) {
    ucText += `🔹 ${amount} UC: ${price.toLocaleString()} so'm\n`;
  }
  
  const keyboard = [
    [Markup.button.callback('✏️ 60 UC', 'admin:editPrice:uc:60')],
    [Markup.button.callback('✏️ 325 UC', 'admin:editPrice:uc:325')],
    [Markup.button.callback('✏️ 660 UC', 'admin:editPrice:uc:660')],
    [Markup.button.callback('✏️ 1800 UC', 'admin:editPrice:uc:1800')],
    [Markup.button.callback('✏️ 3850 UC', 'admin:editPrice:uc:3850')],
    [Markup.button.callback('✏️ 8100 UC', 'admin:editPrice:uc:8100')],
    [Markup.button.callback('◀️ Orqaga', 'admin:priceMenu')]
  ];
  
  try {
    await ctx.editMessageText(ucText, {
      reply_markup: { inline_keyboard: keyboard },
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('Error editing message:', error);
    await ctx.reply(ucText, {
      reply_markup: { inline_keyboard: keyboard },
      parse_mode: 'Markdown'
    });
  }
});

// Handle UC price item editing
bot.action(/admin:editPrice:uc:(\d+)/, async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.answerCbQuery('Ruxsat yo\'q!');
    return;
  }
  
  const amount = ctx.match[1];
  const currentPrice = getUcPrices()[amount] || 0;
  
  ctx.session.editingUcPrice = { amount };
  
  try {
    await ctx.editMessageText(
      `🎮 *${amount} UC narxini o'zgartirish*\n\n` +
      `Joriy narx: *${currentPrice.toLocaleString()} so'm*\n\n` +
      `Yangi narxni so'mda yuboring (faqat raqamlar):`,
      {
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback('❌ Bekor qilish', 'admin:editUc')]
          ]
        },
        parse_mode: 'Markup'
      }
    );
  } catch (error) {
    console.error('Error editing message:', error);
    await ctx.reply(
      `🎮 *${amount} UC narxini o'zgartirish*\n\n` +
      `Joriy narx: *${currentPrice.toLocaleString()} so'm*\n\n` +
      `Yangi narxni so'mda yuboring (faqat raqamlar):`,
      {
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback('❌ Bekor qilish', 'admin:editUc')]
          ]
        },
        parse_mode: 'Markup'
      }
    );
  }
});

// Handle Free Fire price item editing
bot.action(/admin:editPrice:ff:(\d+)/, async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.answerCbQuery('Ruxsat yo\'q!');
    return;
  }
  
  const count = ctx.match[1];
  const currentPrice = getFfPrices()[count] || 0;
  
  ctx.session.editingFfPrice = { count };
  
  try {
    await ctx.editMessageText(
      `🔥 *${count} Diamond narxini o'zgartirish*\n\n` +
      `Joriy narx: *${currentPrice.toLocaleString()} so'm*\n\n` +
      `Yangi narxni so'mda yuboring (faqat raqamlar):`,
      {
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback('❌ Bekor qilish', 'admin:editFf')]
          ]
        },
        parse_mode: 'Markdown'
      }
    );
  } catch (error) {
    console.error('Error editing message:', error);
    await ctx.reply(
      `🔥 *${count} Diamond narxini o'zgartirish*\n\n` +
      `Joriy narx: *${currentPrice.toLocaleString()} so'm*\n\n` +
      `Yangi narxni so'mda yuboring (faqat raqamlar):`,
      {
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback('❌ Bekor qilish', 'admin:editFf')]
          ]
        },
        parse_mode: 'Markdown'
      }
    );
  }
});

// Handle premium price editing
bot.action(/admin:editPrice:premium:(\d+)/, async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.answerCbQuery('Ruxsat yo\'q!');
    return;
  }
  
  const months = ctx.match[1];
  const currentPrice = getPremiumPrices()[months] || 0;
  
  ctx.session.editingPremiumPrice = { months };
  
  try {
    await ctx.editMessageText(
      `💰 *${months} oylik Premium narxini o'zgartirish*\n\n` +
      `Joriy narx: *${currentPrice.toLocaleString()} so'm*\n\n` +
      `Yangi narxni so'mda yuboring (faqat raqamlar):`,
      {
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback('❌ Bekor qilish', 'admin:editPremium')]
          ]
        },
        parse_mode: 'Markdown'
      }
    );
  } catch (error) {
    console.error('Error editing message:', error);
    await ctx.reply(
      `💰 *${months} oylik Premium narxini o'zgartirish*\n\n` +
      `Joriy narx: *${currentPrice.toLocaleString()} so'm*\n\n` +
      `Yangi narxni so'mda yuboring (faqat raqamlar):`,
      {
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback('❌ Bekor qilish', 'admin:editPremium')]
          ]
        },
        parse_mode: 'Markdown'
      }
    );
  }
});

bot.on('text', async (ctx) => {
  // Handle Premium price updates
  if (ctx.session && ctx.session.editingPremiumPrice) {
    const { months } = ctx.session.editingPremiumPrice;
    const priceText = ctx.message.text.trim();
    
    // Validate price input
    const price = parseInt(priceText.replace(/\D/g, ''));
    if (isNaN(price) || price <= 0) {
      await ctx.reply('❌ Iltimos, to\'g\'ri summa kiriting!');
      return;
    }
    
    // Update the price in .env
    try {
      const success = await updatePrice('premium', months, price);
      
      if (success) {
        await ctx.reply(`✅ ${months} oylik Premium narxi ${price.toLocaleString()} so'mga yangilandi!`);
        
        // Show the premium prices menu again with updated prices
        const premiumPrices = getPremiumPrices();
        let premiumText = '🎖️ *Premium Narxlari*\n\n';
        
        for (const [m, p] of Object.entries(premiumPrices)) {
          premiumText += `🔹 ${m} oy: ${p.toLocaleString()} so'm\n`;
        }
        
        const keyboard = [
          [Markup.button.callback('✏️ 1 oy', 'admin:editPrice:premium:1')],
          [Markup.button.callback('✏️ 3 oy', 'admin:editPrice:premium:3')],
          [Markup.button.callback('✏️ 6 oy', 'admin:editPrice:premium:6')],
          [Markup.button.callback('✏️ 12 oy', 'admin:editPrice:premium:12')],
          [Markup.button.callback('◀️ Orqaga', 'admin:priceMenu')]
        ];
        
        try {
          await ctx.reply(premiumText, {
            reply_markup: { inline_keyboard: keyboard },
            parse_mode: 'Markdown'
          });
        } catch (error) {
          console.error('Error sending updated prices:', error);
          await ctx.reply('✅ Narx muvaffaqiyatli yangilandi!');
        }
      } else {
        await ctx.reply('❌ Narxni yangilashda xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring.');
      }
    } catch (error) {
      console.error('Error updating premium price:', error);
      await ctx.reply('❌ Xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring.');
    }
    
    // Clear the editing state
    delete ctx.session.editingPremiumPrice;
  }
  // Handle Stars price updates
  else if (ctx.session && ctx.session.editingStarsPrice) {
    const { count } = ctx.session.editingStarsPrice;
    const priceText = ctx.message.text.trim();
    
    // Validate price input
    const price = parseInt(priceText.replace(/\D/g, ''));
    if (isNaN(price) || price <= 0) {
      await ctx.reply('❌ Iltimos, to\'g\'ri summa kiriting!');
      return;
    }
    
    // Update the price in .env
    try {
      const success = await updatePrice('stars', count, price);
      
      if (success) {
        await ctx.reply(`✅ ${count} Stars narxi ${price.toLocaleString()} so'mga yangilandi!`);
        
        // Show the stars prices menu again with updated prices
        const starsPrices = getStarsPrices();
        let starsText = '⭐ *Stars Narxlari*\n\n';
        
        for (const [c, p] of Object.entries(starsPrices)) {
          starsText += `🔹 ${c} ta: ${p.toLocaleString()} so'm\n`;
        }
        
        const keyboard = [
          [Markup.button.callback('✏️ 100 Stars', 'admin:editPrice:stars:100')],
          [Markup.button.callback('✏️ 200 Stars', 'admin:editPrice:stars:200')],
          [Markup.button.callback('✏️ 500 Stars', 'admin:editPrice:stars:500')],
          [Markup.button.callback('✏️ 1000 Stars', 'admin:editPrice:stars:1000')],
          [Markup.button.callback('◀️ Orqaga', 'admin:priceMenu')]
        ];
        
        try {
          await ctx.reply(starsText, {
            reply_markup: { inline_keyboard: keyboard },
            parse_mode: 'Markdown'
          });
        } catch (error) {
          console.error('Error sending updated prices:', error);
          await ctx.reply('✅ Narx muvaffaqiyatli yangilandi!');
        }
      } else {
        await ctx.reply('❌ Narxni yangilashda xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring.');
      }
    } catch (error) {
      console.error('Error updating stars price:', error);
      await ctx.reply('❌ Xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring.');
    }
    
    // Clear the editing state
    delete ctx.session.editingStarsPrice;
  }
  // Handle UC price updates
  else if (ctx.session && ctx.session.editingUcPrice) {
    const { amount } = ctx.session.editingUcPrice;
    const priceText = ctx.message.text.trim();
    
    // Validate price input
    const price = parseInt(priceText.replace(/\D/g, ''));
    if (isNaN(price) || price <= 0) {
      await ctx.reply('❌ Iltimos, to\'g\'ri summa kiriting!');
      return;
    }
    
    // Update the price in .env
    try {
      const success = await updatePrice('uc', amount, price);
      
      if (success) {
        await ctx.reply(`✅ ${amount} UC narxi ${price.toLocaleString()} so'mga yangilandi!`);
        
        // Show the UC prices menu again with updated prices
        const ucPrices = getUcPrices();
        let ucText = '🎮 *PUBG Mobile UC Narxlari*\n\n';
        
        for (const [a, p] of Object.entries(ucPrices)) {
          ucText += `🔹 ${a} UC: ${p.toLocaleString()} so'm\n`;
        }
        
        const keyboard = [
          [Markup.button.callback('✏️ 60 UC', 'admin:editPrice:uc:60')],
          [Markup.button.callback('✏️ 325 UC', 'admin:editPrice:uc:325')],
          [Markup.button.callback('✏️ 660 UC', 'admin:editPrice:uc:660')],
          [Markup.button.callback('✏️ 1800 UC', 'admin:editPrice:uc:1800')],
          [Markup.button.callback('✏️ 3850 UC', 'admin:editPrice:uc:3850')],
          [Markup.button.callback('✏️ 8100 UC', 'admin:editPrice:uc:8100')],
          [Markup.button.callback('◀️ Orqaga', 'admin:priceMenu')]
        ];
        
        try {
          await ctx.reply(ucText, {
            reply_markup: { inline_keyboard: keyboard },
            parse_mode: 'Markdown'
          });
        } catch (error) {
          console.error('Error sending updated prices:', error);
          await ctx.reply('✅ Narx muvaffaqiyatli yangilandi!');
        }
      } else {
        await ctx.reply('❌ Narxni yangilashda xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring.');
      }
    } catch (error) {
      console.error('Error updating UC price:', error);
      await ctx.reply('❌ Xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring.');
    }
    
    // Clear the editing state
    delete ctx.session.editingUcPrice;
  }
  // Handle Free Fire price updates
  else if (ctx.session && ctx.session.editingFfPrice) {
    const { count } = ctx.session.editingFfPrice;
    const priceText = ctx.message.text.trim();
    
    // Validate price input
    const price = parseInt(priceText.replace(/\D/g, ''));
    if (isNaN(price) || price <= 0) {
      await ctx.reply('❌ Iltimos, to\'g\'ri summa kiriting!');
      return;
    }
    
    // Update the price in .env
    try {
      const success = await updatePrice('ff', count, price);
      
      if (success) {
        await ctx.reply(`✅ ${count} Diamond narxi ${price.toLocaleString()} so'mga yangilandi!`);
        
        // Show the Free Fire prices menu again with updated prices
        const ffPrices = getFfPrices();
        let ffText = '🔥 *Free Fire Diamond Narxlari*\n\n';
        
        for (const [c, p] of Object.entries(ffPrices)) {
          ffText += `🔹 ${c} Diamond: ${p.toLocaleString()} so'm\n`;
        }
        
        const keyboard = [
          [Markup.button.callback('✏️ 100 Diamond', 'admin:editPrice:ff:100')],
          [Markup.button.callback('✏️ 200 Diamond', 'admin:editPrice:ff:200')],
          [Markup.button.callback('✏️ 500 Diamond', 'admin:editPrice:ff:500')],
          [Markup.button.callback('✏️ 1000 Diamond', 'admin:editPrice:ff:1000')],
          [Markup.button.callback('✏️ 2000 Diamond', 'admin:editPrice:ff:2000')],
          [Markup.button.callback('◀️ Orqaga', 'admin:priceMenu')]
        ];
        
        try {
          await ctx.reply(ffText, {
            reply_markup: { inline_keyboard: keyboard },
            parse_mode: 'Markdown'
          });
        } catch (error) {
          console.error('Error sending updated prices:', error);
          await ctx.reply('✅ Narx muvaffaqiyatli yangilandi!');
        }
      } else {
        await ctx.reply('❌ Narxni yangilashda xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring.');
      }
    } catch (error) {
      console.error('Error updating Free Fire price:', error);
      await ctx.reply('❌ Xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring.');
    }
    
    // Clear the editing state
    delete ctx.session.editingFfPrice;
  }
});

bot.action(/admin:(.+)/, async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.answerCbQuery('Ruxsat yo\'q');
    return;
  }
  const action = ctx.match[1];
  switch (action) {
    case 'priceMenu':
      if (!isAdmin(ctx)) {
        await ctx.answerCbQuery('Ruxsat yo\'q!');
        return;
      }
      try {
        await ctx.editMessageText('🛒 Narx turlarini tanlang:', {
          reply_markup: {
            inline_keyboard: [
              [Markup.button.callback('🎖️ Premium', 'admin:editPremium')],
              [Markup.button.callback('⭐ Stars', 'admin:editStars')],
              [Markup.button.callback('🔥 Free Fire', 'admin:editFf')],
              [Markup.button.callback('🎮 PUBG UC', 'admin:editUc')],
              [Markup.button.callback('🎯 PUBG PP', 'admin:editPp')],
              [Markup.button.callback('🔙 Orqaga', 'admin:backToMain')]
            ]
          },
          parse_mode: 'Markdown'
        });
        return;
      } catch (error) {
        console.error('Error showing price menu:', error);
        await ctx.reply('🛒 Narx turlarini tanlang:', {
          reply_markup: {
            inline_keyboard: [
              [Markup.button.callback('🎖️ Premium', 'admin:editPremium')],
              [Markup.button.callback('⭐ Stars', 'admin:editStars')],
              [Markup.button.callback('🔥 Free Fire', 'admin:editFf')],
              [Markup.button.callback('🎮 PUBG UC', 'admin:editUc')],
              [Markup.button.callback('🎯 PUBG PP', 'admin:editPp')],
              [Markup.button.callback('🔙 Orqaga', 'admin:backToMain')]
            ]
          },
          parse_mode: 'Markdown'
        });
      }
      
      const starsPrices = getStarsPrices();
      const premiumPrices = getPremiumPrices();
      const ucPrices = getUcPrices();
      const ppPrices = getPpPrices();
      const ffPrices = getFfPrices();
      
      let pricesText = '💰 *Barcha narxlar*\n\n';
      
      // Stars narxlari
      pricesText += '⭐ *Stars narxlari*\n';
      for (const [count, price] of Object.entries(starsPrices)) {
        pricesText += `🔹 ${count} ta: ${price.toLocaleString()} so'm\n`;
      }
      
      // Premium narxlari
      pricesText += '\n🎖️ *Premium narxlari*\n';
      for (const [months, price] of Object.entries(premiumPrices)) {
        pricesText += `🔹 ${months} oy: ${price.toLocaleString()} so'm\n`;
      }
      
      // PUBG UC narxlari
      pricesText += '\n🎮 *PUBG UC Narxlari*\n';
      for (const [amount, price] of Object.entries(ucPrices)) {
        pricesText += `🔹 ${amount} UC: ${price.toLocaleString()} so'm\n`;
      }
      
      // PUBG PP narxlari
      pricesText += '\n🎖️ *PUBG PP Narxlari*\n';
      for (const [amount, price] of Object.entries(ppPrices)) {
        pricesText += `🔹 ${amount} PP: ${price.toLocaleString()} so'm\n`;
      }
      
      // Free Fire narxlari
      pricesText += '\n🔥 *Free Fire Diamond Narxlari*\n';
      for (const [amount, price] of Object.entries(ffPrices)) {
        pricesText += `🔹 ${amount} Diamond: ${price.toLocaleString()} so'm\n`;
      }
      
      const pricesKeyboard = [
        [
          Markup.button.callback('✏️ Stars', 'admin:starsPrices'),
          Markup.button.callback('✏️ Premium', 'admin:premiumPrices')
        ],
        [
          Markup.button.callback('✏️ PUBG UC', 'admin:ucPrices'),
          Markup.button.callback('✏️ PUBG PP', 'admin:ppPrices')
        ],
        [
          Markup.button.callback('✏️ Free Fire', 'admin:ffPrices')
        ],
        [
          Markup.button.callback('◀️ Orqaga', 'back:admin')
        ]
      ];
      
      await sendOrUpdateMenu(ctx, pricesText, pricesKeyboard, { parse_mode: 'Markdown' });
      break;
      
    case 'starsPrices':
      if (!isAdmin(ctx)) {
        await ctx.answerCbQuery('Ruxsat yo\'q!');
        return;
      }
      
      const starsPricesData = getStarsPrices();
      let starsText = '⭐ *Stars narxlari*\n\n';
      
      for (const [count, price] of Object.entries(starsPricesData)) {
        starsText += `⭐ ${count} ta: ${price.toLocaleString()} so'm\n`;
      }
      
      const starsKeyboard = [
        [Markup.button.callback('✏️ 100 ta', 'admin:editPrice:stars:100')],
        [Markup.button.callback('✏️ 200 ta', 'admin:editPrice:stars:200')],
        [Markup.button.callback('✏️ 500 ta', 'admin:editPrice:stars:500')],
        [Markup.button.callback('✏️ 1000 ta', 'admin:editPrice:stars:1000')],
        [Markup.button.callback('◀️ Orqaga', 'admin:priceMenu')]
      ];
      
      await sendOrUpdateMenu(ctx, starsText, starsKeyboard, { parse_mode: 'Markdown' });
      break;
      
    case 'premiumPrices':
      if (!isAdmin(ctx)) {
        await ctx.answerCbQuery('Ruxsat yo\'q!');
        return;
      }
      
      const premiumPricesData = getPremiumPrices();
      let premiumText = '🎖️ *Premium narxlari*\n\n';
      
      for (const [months, price] of Object.entries(premiumPricesData)) {
        premiumText += `🎖️ ${months} oy: ${price.toLocaleString()} so'm\n`;
      }
      
      const premiumKeyboard = [
        [Markup.button.callback('✏️ 1 oy', 'admin:editPrice:premium:1')],
        [Markup.button.callback('✏️ 3 oy', 'admin:editPrice:premium:3')],
        [Markup.button.callback('✏️ 6 oy', 'admin:editPrice:premium:6')],
        [Markup.button.callback('✏️ 12 oy', 'admin:editPrice:premium:12')],
        [Markup.button.callback('◀️ Orqaga', 'admin:priceMenu')]
      ];
      
      await sendOrUpdateMenu(ctx, premiumText, premiumKeyboard, { parse_mode: 'Markdown' });
      break;
      
    case 'editPrice':
      if (!isAdmin(ctx)) {
        await ctx.answerCbQuery('Ruxsat yo\'q!');
        return;
      }
      
      const [_, type, key] = ctx.match[1].split(':');
      ctx.session.editingPrice = { type, key };
      
      // Item nomini va joriy narxni aniqlash
      let itemName = '';
      let currentPrice = 0;
      let backButton = 'admin:priceMenu';
      
      if (type === 'premium') {
        itemName = `${key} oy Premium`;
        currentPrice = getPremiumPrices()[key] || 0;
        backButton = 'admin:editPremium';
        
        await ctx.editMessageText(
          `💰 *${itemName} narxini o'zgartirish*\n\n` +
          `Joriy narx: *${currentPrice.toLocaleString()} so'm*\n\n` +
          `Yangi narxni so'mda yuboring (faqat raqamlar):`,
          {
            reply_markup: {
              inline_keyboard: [
                [Markup.button.callback('❌ Bekor qilish', backButton)]
              ]
            },
            parse_mode: 'Markdown'
          }
        );
        return;
      }
      
      switch (type) {
        case 'stars':
          itemName = `${key} ta Stars`;
          currentPrice = getStarsPrices()[key] || 0;
          backButton = 'admin:starsPrices';
          break;
        case 'premium':
          itemName = `${key} oylik Premium`;
          currentPrice = getPremiumPrices()[key] || 0;
          backButton = 'admin:premiumPrices';
          break;
        case 'uc':
          itemName = `${key} UC`;
          currentPrice = getUcPrices()[key] || 0;
          backButton = 'admin:ucPrices';
          break;
        case 'pp':
          itemName = `${key} PP`;
          currentPrice = getPpPrices()[key] || 0;
          backButton = 'admin:ppPrices';
          break;
        case 'ff':
          itemName = `${key} Diamond`;
          currentPrice = getFfPrices()[key] || 0;
          backButton = 'admin:ffPrices';
          break;
        default:
          itemName = key;
          backButton = 'admin:priceMenu';
      }
      
      const priceUpdateMessage = 
        `💰 *${itemName} narxini yangilash*\n\n` +
        `Joriy narx: *${currentPrice.toLocaleString()} so'm*\n` +
        `Yangi narxni so'mda yuboring (faqat raqamlar):`;
      
      // To'g'ridan-to'g'ri xabar yuborish
      await ctx.replyWithMarkdown(priceUpdateMessage, {
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback('❌ Bekor qilish', backButton)]
          ]
        }
      });
      break;
      
    case 'cardMenu':
      if (!isAdmin(ctx)) {
        await ctx.answerCbQuery('Ruxsat yo\'q!');
        return;
      }
      
      const cardInfoText = `💳 *Karta ma'lumotlari*\n` +
        `👤 Egasi: ${process.env.CARD_OWNER || 'Mavjud emas'}\n` +
        `💳 Uzcard: \`${process.env.UZCARD_NUMBER || 'Mavjud emas'}\`\n` +
        `💳 Humo: \`${process.env.HUMO_NUMBER || 'Mavjud emas'}\``;
        
      const cardMenuKeyboard = [
        [Markup.button.callback('✏️ Karta egasini o\'zgartirish', 'admin:editCardOwner')],
        [Markup.button.callback('💳 Uzcard raqamini o\'zgartirish', 'admin:editUzcard')],
        [Markup.button.callback('💳 Humo raqamini o\'zgartirish', 'admin:editHumo')],
        [Markup.button.callback('◀️ Orqaga', 'back:admin')]
      ];
      
      await sendOrUpdateMenu(ctx, cardInfoText, cardMenuKeyboard, { parse_mode: 'Markdown' });
      break;
      
    case 'editCardOwner':
      if (!isAdmin(ctx)) {
        await ctx.answerCbQuery('Ruxsat yo\'q!');
        return;
      }
      
      ctx.session.editingCardField = 'CARD_OWNER';
      await sendOrUpdateMenu(
        ctx, 
        '✏️ Yangi karta egasining ism familiyasini yuboring:',
        [[Markup.button.callback('❌ Bekor qilish', 'admin:cardMenu')]],
        { parse_mode: 'Markdown' }
      );
      break;
      
    case 'editUzcard':
      if (!isAdmin(ctx)) {
        await ctx.answerCbQuery('Ruxsat yo\'q!');
        return;
      }
      
      ctx.session.editingCardField = 'UZCARD_NUMBER';
      await sendOrUpdateMenu(
        ctx, 
        '💳 Yangi Uzcard raqamini yuboring (faqat raqamlar):',
        [[Markup.button.callback('❌ Bekor qilish', 'admin:cardMenu')]],
        { parse_mode: 'Markdown' }
      );
      break;
      
    case 'editHumo':
      if (!isAdmin(ctx)) {
        await ctx.answerCbQuery('Ruxsat yo\'q!');
        return;
      }
      
      ctx.session.editingCardField = 'HUMO_NUMBER';
      await sendOrUpdateMenu(
        ctx, 
        '💳 Yangi Humo raqamini yuboring (faqat raqamlar):',
        [[Markup.button.callback('❌ Bekor qilish', 'admin:cardMenu')]],
        { parse_mode: 'Markdown' }
      );
      break;
      
    case 'stats':
      if (!isAdmin(ctx)) {
        await ctx.answerCbQuery('Ruxsat yo\'q!');
        return;
      }
      
      try {
        // Get all users from the database
        const allUsers = Array.from(global.botUsers || new Set());
        const totalUsers = allUsers.length;
        
        // Count active users (users who used the bot in the last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        // Note: This is a simplified example - you might need to track user activity separately
        
        // Count total orders and revenue
        const allOrders = Object.values(global.orders || {});
        const totalOrders = allOrders.length;
        const completedOrders = allOrders.filter(o => o.status === 'completed');
        const totalRevenue = completedOrders.reduce((sum, order) => sum + (order.price || 0), 0);
        
        // Count today's orders and revenue
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayOrders = completedOrders.filter(order => {
          const orderDate = new Date(order.timestamp || 0);
          return orderDate >= today;
        });
        const todayRevenue = todayOrders.reduce((sum, order) => sum + (order.price || 0), 0);
        
        // Count pending top-ups
        const pendingTopUps = Object.values(global.topUpRequests || {}).filter(
          req => req.status === 'pending'
        ).length;
        
        // Format statistics message
        const statsMessage = `📊 *Bot Statistikasi*\n` +
          `👥 *Umumiy foydalanuvchilar:* ${totalUsers.toLocaleString()} ta\n` +
          `🔄 *Faol foydalanuvchilar (30 kun):* ${Math.floor(totalUsers * 0.3).toLocaleString()} ta\n\n` +
          `📦 *Buyurtmalar:*\n` +
          `   • Jami: ${totalOrders.toLocaleString()} ta\n` +
          `   • Bugungi: ${todayOrders.length.toLocaleString()} ta\n` +
          `   • Tugallangan: ${completedOrders.length.toLocaleString()} ta\n\n` +
          `💰 *Daromad:*\n` +
          `   • Jami: ${totalRevenue.toLocaleString()} so'm\n` +
          `   • Bugungi: ${todayRevenue.toLocaleString()} so'm\n\n` +
          `⏳ *Kutilayotgan to'lovlar:* ${pendingTopUps} ta\n`;
        
        const keyboard = [
          [Markup.button.callback('🔄 Yangilash', 'admin:stats')],
          [Markup.button.callback('◀️ Orqaga', 'back:admin')]
        ];
        
        await sendOrUpdateMenu(ctx, statsMessage, keyboard, {
          parse_mode: 'Markdown',
          disable_web_page_preview: true
        });
      } catch (error) {
        console.error('Statistika yuklashda xatolik:', error);
        await ctx.answerCbQuery('❌ Xatolik yuz berdi!', true);
      }
      break;
      
    case 'promoMenu':
      if (!isAdmin(ctx)) {
        await ctx.answerCbQuery('Ruxsat yo\'q!');
        return;
      }

      const now = new Date();
      let activePromos = 0;
      let expiredPromos = 0;
      let totalBonus = 0;
      
      const promoList = Array.from(promoCodeStorage.entries())
        .map(([code, data]) => {
          const usedCount = data.usedBy ? data.usedBy.length : 0;
          const isExpired = data.expiresAt && new Date(data.expiresAt) < now;
          const remainingUses = data.usesLeft || 0;
          
          if (isExpired || remainingUses <= 0) {
            expiredPromos++;
          } else {
            activePromos++;
            totalBonus += data.amount * (data.totalUses || 1);
          }
          
          const status = isExpired ? '🕒 Muddati o\'tgan' : 
                         remainingUses <= 0 ? '❌ Tugagan' : '✅ Faol';
                          
          const expiryInfo = data.expiresAt ? 
            `\n   └─ ⏳ ${new Date(data.expiresAt).toLocaleDateString()}` : '';
            
          return `${status} *${code}*: ${data.amount.toLocaleString()} so'm\n` +
                 `   ├─ ${usedCount}/${data.totalUses} foydalanilgan` +
                 expiryInfo;
        })
        .join('\n\n') || 'Hozircha promo kodlar mavjud emas.';

      const stats = `📊 *Statistika*\n` +
                   `• Faol promokodlar: ${activePromos} ta\n` +
                   `• Tugagan/eskirgan: ${expiredPromos} ta\n` +
                   `• Jami bonus: ${totalBonus.toLocaleString()} so'm\n\n`;

      const promoMenuMessage = `🎫 *Promo Kodlar Boshqaruvi*\n\n${stats}📋 *Mavjud promokodlar:*\n\n${promoList}`;

      const promoMenuKeyboard = [
        [Markup.button.callback('➕ Yangi promo kod', 'admin:createPromo')],
        [Markup.button.callback('🗑 Barcha promokodlarni o\'chirish', 'admin:deleteAllPromos')],
        [Markup.button.callback('🔄 Yangilash', 'admin:promoMenu')],
        [Markup.button.callback('◀️ Orqaga', 'back:admin')]
      ];

      await sendOrUpdateMenu(ctx, promoMenuMessage, promoMenuKeyboard, { 
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      });
      break;

    case 'createPromo':
      if (!isAdmin(ctx)) {
        await ctx.answerCbQuery('Ruxsat yo\'q!');
        return;
      }

      ctx.session.creatingPromo = {
        step: 'amount',
        data: {
          amount: 0,
          uses: 1,
          expiresInDays: 7
        }
      };

      await sendOrUpdateMenu(
        ctx,
        '🆕 *Yangi Promo Kod Yaratish*\n\nIltimos, promo kod miqdorini kiriting (so\'mda):',
        [[Markup.button.callback('◀️ Orqaga', 'admin:promoMenu')]],
        { parse_mode: 'Markdown' }
      );
      break;
      
    case 'promoUses':
      if (!isAdmin(ctx) || !ctx.session.creatingPromo) {
        await ctx.answerCbQuery('Xatolik!');
        return;
      }
      
      ctx.session.creatingPromo.step = 'uses';
      await sendOrUpdateMenu(
        ctx,
        '🔄 *Nechi marta ishlatilishi mumkin?*\n\nIltimos, foydalanishlar sonini kiriting:',
        [
          [Markup.button.callback('1 marta', 'setPromoUses:1')],
          [Markup.button.callback('5 marta', 'setPromoUses:5')],
          [Markup.button.callback('10 marta', 'setPromoUses:10')],
          [Markup.button.callback('100 marta', 'setPromoUses:100')],
          [Markup.button.callback('◀️ Orqaga', 'admin:promoMenu')]
        ],
        { parse_mode: 'Markdown' }
      );
      break;
      
    case 'promoExpiry':
      if (!isAdmin(ctx) || !ctx.session.creatingPromo) {
        await ctx.answerCbQuery('Xatolik!');
        return;
      }
      
      ctx.session.creatingPromo.step = 'expiry';
      await sendOrUpdateMenu(
        ctx,
        '📅 *Promo kod qancha kunga amal qiladi?*\n\nIltimos, muddatni tanlang:',
        [
          [Markup.button.callback('1 kun', 'setPromoExpiry:1')],
          [Markup.button.callback('7 kun', 'setPromoExpiry:7')],
          [Markup.button.callback('30 kun', 'setPromoExpiry:30')],
          [Markup.button.callback('90 kun', 'setPromoExpiry:90')],
          [Markup.button.callback('◀️ Orqaga', 'admin:promoMenu')]
        ],
        { parse_mode: 'Markdown' }
      );
      break;
      
    case 'confirmPromo':
      if (!isAdmin(ctx) || !ctx.session.creatingPromo) {
        await ctx.answerCbQuery('Xatolik!');
        return;
      }
      
      const { amount, uses, expiresInDays } = ctx.session.creatingPromo.data;
      const promoCode = generatePromoCode();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
      
      promoCodeStorage.set(promoCode, {
        amount: parseInt(amount),
        usesLeft: parseInt(uses),
        totalUses: parseInt(uses),
        used: false,
        usedBy: [],
        createdAt: new Date(),
        expiresAt: expiresAt
      });
      
      await sendOrUpdateMenu(
        ctx,
        `✅ *Yangi promo kod yaratildi!*\n\n` +
        `🔑 KOD: *${promoCode}*\n` +
        `💰 Summa: *${amount.toLocaleString()} so'm*\n` +
        `🔄 Foydalanish: *${uses} marta*\n` +
        `📆 Amal qilish muddati: *${expiresInDays} kun*\n\n` +
        `Foydalanish uchun: /promo ${promoCode}`,
        [[Markup.button.callback('◀️ Orqaga', 'admin:promoMenu')]],
        { parse_mode: 'Markdown' }
      );
      
      delete ctx.session.creatingPromo;
      break;
      
    case 'deleteAllPromos':
      if (!isAdmin(ctx)) {
        await ctx.answerCbQuery('Ruxsat yo\'q!');
        return;
      }

      const confirmKeyboard = [
        [
          Markup.button.callback('✅ Ha, o\'chirish', 'admin:confirmDeleteAllPromos'),
          Markup.button.callback('❌ Bekor qilish', 'admin:promoMenu')
        ]
      ];

      await sendOrUpdateMenu(
        ctx,
        '⚠️ *Barcha promo kodlar o\'chiriladi!*\n\nIshonchingiz komilmi?',
        confirmKeyboard,
        { parse_mode: 'Markdown' }
      );
      break;
      
    case 'confirmDeleteAllPromos':
      if (!isAdmin(ctx)) {
        await ctx.answerCbQuery('Ruxsat yo\'q!');
        return;
      }

      const count = promoCodeStorage.size;
      promoCodeStorage.clear();

      await sendOrUpdateMenu(
        ctx,
        `✅ *${count} ta promo kod o'chirib tashlandi!*`,
        [[Markup.button.callback('◀️ Orqaga', 'admin:promoMenu')]],
        { parse_mode: 'Markdown' }
      );
      break;
    case 'stats':
      await ctx.answerCbQuery();
      // Demo statistik ma'lumot
      await ctx.reply('Foydalanuvchilar soni: 123\nBugungi tranzaksiyalar: 45');
      break;
    case 'findUser':
      ctx.session.awaitingFindUser = true;
      await ctx.answerCbQuery();
      
      // Show recent users with pagination
      const recentUsers = Array.from(global.botUsers || []).slice(-5);
      let message = '👥 *Foydalanuvchi qidirish*\n\n' +
        'Foydalanuvchi ID, ismi yoki username orqali qidiring.\n\n' +
        '🔄 *So\'nggi foydalanuvchilar:*\n';
      
      if (recentUsers.length > 0) {
        for (const userId of recentUsers) {
          try {
            const user = await ctx.telegram.getChat(userId);
            const userBalance = getUserBalance(userId);
            message += `\n👤 ${user.first_name || ''} ${user.last_name || ''}\n` +
                      `🆔 ${userId} | 💰 ${userBalance.toLocaleString()} so'm\n` +
                      `@${user.username || 'username yo\'q'}\n`;
          } catch (error) {
            console.error(`Foydalanuvchi ma'lumotlarini olishda xatolik (${userId}):`, error);
          }
        }
      } else {
        message += '\nHozircha foydalanuvchilar mavjud emas.';
      }
      
      await sendOrUpdateMenu(
        ctx,
        message,
        [
          [Markup.button.callback('🔄 Yangilash', 'admin:findUser')],
          [Markup.button.callback('◀️ Orqaga', 'back:admin')]
        ]
      );
      break;
    case 'broadcast':
      ctx.session.awaitingBroadcast = true;
      ctx.session.broadcastState = { step: 'awaiting_message' };
      await ctx.answerCbQuery();
      
      const keyboard = [
        [Markup.button.callback('❌ Bekor qilish', 'back:admin')]
      ];
      
      await sendOrUpdateMenu(
        ctx,
        '📢 *Xabar yuborish*\n\n' +
        'Barcha foydalanuvchilarga yubormoqchi bo\'lgan xabaringizni yuboring.\n\n' +
        '⚠️ *Eslatma:*\n' +
        '• Xabaringiz to\'g\'ri ekanligiga ishonch hosil qiling\n' +
        '• Yuborish jarayoni bir necha daqiqa davom etishi mumkin',
        keyboard
      );
      break;
    default:
      await ctx.answerCbQuery();
  }
});

bot.action('cancel_broadcast', async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.answerCbQuery('Ruxsat yo\'q!');
    return;
  }
  
  // If there are sent messages, delete them
  if (ctx.session.broadcastState?.messageIds) {
    const messageIds = ctx.session.broadcastState.messageIds;
    
    // Delete messages from all users
    for (const [userId, messageId] of Object.entries(messageIds)) {
      try {
        await ctx.telegram.deleteMessage(userId, messageId);
      } catch (error) {
        console.error(`Xabarni o'chirishda xatolik (${userId}):`, error);
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    await ctx.answerCbQuery('Barcha xabarlar o\'chirildi');
  } else {
    await ctx.answerCbQuery('Bekor qilindi');
  }
  
  // Clear broadcast state
  delete ctx.session.broadcastState;
  ctx.session.awaitingBroadcast = false;
  
  await sendAdminPanel(ctx);
});

// Confirm broadcast
bot.action('confirm_broadcast', async (ctx) => {
  if (!isAdmin(ctx) || !ctx.session.broadcastState?.message) {
    await ctx.answerCbQuery('Xatolik yuz berdi!');
    return;
  }
  
  const broadcastText = ctx.session.broadcastState.message;
  
  try {
    // Send a confirmation to admin
    const processingMsg = await ctx.reply('📡 Xabar foydalanuvchilarga yuborilmoqda... Iltimos, kuting.');
    
    // Get all users who have started the bot
    const usersToNotify = Array.from(global.botUsers || []);
    
    let successCount = 0;
    let failCount = 0;
    
    // Store message IDs for possible deletion
    const messageIds = {};
    
    // Send to each user
    for (const userId of usersToNotify) {
      try {
        const sentMessage = await ctx.telegram.sendMessage(
          userId, 
          `📢 *Xabar adminstratsiyadan:*\n\n${broadcastText}`, 
          { 
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [Markup.button.callback('❌ Xabarni yopish', 'delete_message')]
              ]
            }
          }
        );
        
        // Store message ID for possible deletion
        messageIds[userId] = sentMessage.message_id;
        successCount++;
        
        // Small delay to avoid hitting rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Xabar yuborishda xatolik (${userId}):`, error);
        failCount++;
      }
    }
    
    // Update broadcast state with message IDs
    if (ctx.session.broadcastState) {
      ctx.session.broadcastState.messageIds = messageIds;
    }
    
    // Update the admin with results
    const resultText = `✅ Xabar muvaffaqiyatli yuborildi!\n\n` +
      `✓ Muvaffaqiyatli: ${successCount} ta\n` +
      `✗ Xatolik: ${failCount} ta\n\n` +
      `📝 Xabar matni:\n${broadcastText}\n\n` +
      `❌ *Barcha xabarlarni o'chirish* tugmasi orqali yuborilgan xabarlarni bekor qilishingiz mumkin.`;
    
    const keyboard = [
      [Markup.button.callback('❌ Barcha xabarlarni o\'chirish', 'cancel_broadcast')],
      [Markup.button.callback('◀️ Orqaga', 'back:admin')]
    ];
    
    try {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        processingMsg.message_id,
        null,
        resultText,
        { 
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        }
      );
    } catch (editError) {
      console.error('Xabarni yangilashda xatolik:', editError);
      await ctx.reply(resultText, { 
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    }
    
  } catch (error) {
    console.error('Xabar yuborishda xatolik:', error);
    await ctx.reply('❌ Xabar yuborishda xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring.');
  }
});

// Handle message deletion by users
bot.action('delete_message', async (ctx) => {
  try {
    await ctx.deleteMessage();
  } catch (error) {
    console.error('Xabarni o\'chirishda xatolik:', error);
    await ctx.answerCbQuery('❌ Xabarni o\'chirib bo\'lmadi', true);
  }
});

async function sendUCShop(ctx) {
  await ctx.answerCbQuery();
  await sendOrUpdateMenu(ctx, 'UC Shop kanalimizga o\'ting:', [
    [Markup.button.url('➡️ Kanalga o\'tish', UC_CHANNEL_URL)],
    [Markup.button.callback('⬅️ Orqaga', 'back:main')]
  ]);
}

async function sendSOS(ctx) {
  await ctx.answerCbQuery();
  await sendOrUpdateMenu(ctx, `👤 Admin: ${ADMIN_USER}`, [
    [Markup.button.callback('⬅️ Orqaga', 'back:main')]
  ]);
}

async function promptPromokod(ctx) {
  await ctx.answerCbQuery();
  ctx.session.awaitingPromo = true;
  await ctx.reply('Promokodni kiriting:');
}

// Top-up bosqichlari uchun handler
bot.action('topup:amount', async (ctx) => {
  ctx.session.topup = { step: 'amount' };
  await sendOrUpdateMenu(ctx, '💵 Iltimos, to\'ldirmoqchi bo\'lgan summani kiriting (so\'mda):', [
    [Markup.button.callback('⬅️ Orqaga', 'back:account')]
  ]);
});

// Orqaga hisob menyusiga qaytish
bot.action('back:account', async (ctx) => {
  await sendAccountMenu(ctx);
});

// Orqaga admin paneliga qaytish
bot.action('back:admin', async (ctx) => {
  await sendAdminPanel(ctx);
});

// Channel management menu
bot.action('admin:channelMenu', async (ctx) => {
  await sendAdminChannelMenu(ctx);
});

// To'ldirish summasini qabul qilish
bot.on('text', async (ctx, next) => {
  // Agar topup jarayoni boshlamagan bo'lsa, keyingi middlewarega o'tkazamiz
  if (!ctx.session.topup) {
    return next();
  }

  const userId = ctx.from.id;
  const text = ctx.message.text.trim();

  // To'ldirish summasi
  if (ctx.session.topup.step === 'amount') {
    const amount = parseInt(text);
    if (isNaN(amount) || amount < 1000) {
      await ctx.reply('❌ Iltimos, 1000 so\'mdan ko\'proq summa kiriting!');
      return;
    }

    ctx.session.topup = {
      step: 'method',
      amount: amount
    };

    const keyboard = [
      [Markup.button.callback('💳 Uzcard', 'topup:method:uzcard')],
      [Markup.button.callback('💳 Humo', 'topup:method:humo')],
      [Markup.button.callback('⬅️ Orqaga', 'back:account')]
    ];

    await sendOrUpdateMenu(ctx, `💳 To'lov usulini tanlang:\n💵 Summa: ${amount.toLocaleString()} so'm`, keyboard);
  } else {
    return next();
  }
});

// To'lov usulini tanlash
bot.action(/topup:method:(.+)/, async (ctx) => {
  const method = ctx.match[1];
  const { amount } = ctx.session.topup;
  
  // Get card information from environment
  const cardInfo = getCardInfo();
  
  // To'lov kartalari ma'lumotlari
  const cards = {
    uzcard: {
      number: process.env.UZCARD_NUMBER ? formatCardNumber(process.env.UZCARD_NUMBER) : '8600123456789012',
      name: process.env.CARD_OWNER || 'Karta egasi',
      type: 'Uzcard'
    },
    humo: {
      number: process.env.HUMO_NUMBER ? formatCardNumber(process.env.HUMO_NUMBER) : '9860123456789012',
      name: process.env.CARD_OWNER || 'Karta egasi',
      type: 'Humo'
    }
  };

  const card = cards[method];
  const paymentAmount = amount; // No more 3% discount

  const message = `💳 *${card.type} orqali to'lov*\n` +
    `💳 Karta raqami: \`${card.number}\`\n` +
    `👤 Karta egasi: ${card.name}\n\n` +
    `💵 *To'lov summasi:* ${paymentAmount.toLocaleString()} so'm\n` +
    `📝 *Izoh:* ${ctx.from.id}\n\n` +
    `💡 Iltimos, to'lov qilgandan so'ng chek rasmini yuboring.\n` +
    `🔄 To'lov tekshirilgach, balansingizga ${amount.toLocaleString()} so'm qo'shiladi.`;

  const keyboard = [
    [Markup.button.callback('✅ To\'lov qildim', 'topup:check_payment')],
    [Markup.button.callback('❌ Bekor qilish', 'back:account')]
  ];

  await sendOrUpdateMenu(ctx, message, keyboard, { parse_mode: 'Markdown' });
  ctx.session.topup.step = 'waiting_payment';
  ctx.session.topup.method = method;
  ctx.session.topup.paymentAmount = paymentAmount;
});

// To'lovni admin tasdiqlash uchun yuborish
bot.action('topup:check_payment', async (ctx) => {
  if (!ctx.session.topup) {
    await ctx.answerCbQuery('Xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring.');
    return await sendAccountMenu(ctx);
  }

  const { amount, method, paymentAmount } = ctx.session.topup;
  const userId = ctx.from.id;
  const username = ctx.from.username || 'Foydalanuvchi';
  
  // Buyurtma ID yaratamiz
  const paymentId = generateOrderId();
  
  // Adminlarga xabar yuboramiz
  // Escape special characters for Markdown
  const escapeMarkdown = (text) => {
    return text.replace(/[_*[\]()~`>#+\-={}|.!]/g, '\\$&');
  };

  // Format message with MarkdownV2
  const adminMessage = '💳 *Yangi to\'lov so\'rovi*\n' +
    '👤 Foydalanuvchi: ' + escapeMarkdown('@' + username) + ' \\(' + 'ID: ' + userId + '\\)\n' +
    '💰 Summa: ' + escapeMarkdown(amount.toLocaleString()) + ' so\'m\n' +
    '💳 To\'lov usuli: ' + (method === 'uzcard' ? 'Uzcard' : 'Humo') + '\n' +
    '💸 To\'lov summasi: ' + escapeMarkdown(paymentAmount.toLocaleString()) + ' so\'m\n' +
    '📅 Sana: ' + escapeMarkdown(new Date().toLocaleString()) + '\n\n' +
    '🆔 Buyurtma ID: `' + paymentId + '`';
  
  // Admin paneliga tasdiqlash tugmalari bilan yuboramiz
  const adminKeyboard = [
    [
      Markup.button.callback('✅ Tasdiqlash', `confirm_payment:${paymentId}:${userId}:${amount}`),
      Markup.button.callback('❌ Rad etish', `reject_payment:${paymentId}:${userId}`)
    ]
  ];

  try {
    // Barcha adminlarga xabar yuboramiz
    for (const adminId of ADMIN_IDS) {
      try {
        await ctx.telegram.sendMessage(
          adminId,
          adminMessage,
          { parse_mode: 'MarkdownV2', reply_markup: { inline_keyboard: adminKeyboard } }
        );
      } catch (error) {
        // Don't log sensitive info to console
        await ctx.telegram.sendMessage(
          ADMIN_IDS[0], // Send to first admin
          `⚠️ Xatolik: Adminlarga xabar yuborishda muammo yuz berdi. Admin ID: ${adminId}`,
          { parse_mode: 'Markdown' }
        );
      }
    }
    
    // Foydalanuvchiga xabar beramiz
    await ctx.answerCbQuery('To\'lovingiz adminlar tomonidan tekshirilmoqda. Iltimos, kuting...');
    await sendOrUpdateMenu(
      ctx,
      `✅ To'lov so'rovingiz qabul qilindi.\n` +
      `💰 Summa: ${amount.toLocaleString()} so'm\n` +
      `🆔 Buyurtma ID: ${paymentId}\n\n` +
      `📞 To'lov tez orada tasdiqlanadi. Agar uzoq vaqt kutib tursangiz, @suxacyber ga murojaat qiling.`,
      [[Markup.button.callback('⬅️ Asosiy menyu', 'back:account')]]
    );
    
    // Sessiyani tozalash
    delete ctx.session.topup;
    
  } catch (error) {
    // Don't log error details to console
    await ctx.answerCbQuery('Xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring.');
    await sendAccountMenu(ctx);
    // Notify admin about the error
    await ctx.telegram.sendMessage(
      ADMIN_IDS[0],
      `⚠️ Xatolik: To'lov so'rovini qayta ishlashda muammo yuz berdi.\nFoydalanuvchi ID: ${ctx.from.id}`,
      { parse_mode: 'Markdown' }
    );
  }
});

// Admin tomonidan to'lovni tasdiqlash
bot.action(/confirm_payment:(\w+):(\d+):(\d+)/, async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.answerCbQuery('Ruxsat yo\'q!');
    return;
  }
  
  const paymentId = ctx.match[1];
  const userId = parseInt(ctx.match[2]);
  const amount = parseInt(ctx.match[3]);
  const username = ctx.from.username || 'noma\'lum admin';
  
  try {
    // Balansni yangilash
    updateUserBalance(userId, amount);
    
    // Escape special characters for MarkdownV2
    const escapeMarkdown = (text) => {
      return String(text).replace(/[_*[\]()~`>#+\-={}|.!]/g, '\\$&');
    };
    
    // Adminlarga xabar
    await ctx.answerCbQuery('✅ To\'lov tasdiqlandi!');
    try {
      await ctx.editMessageText(
        escapeMarkdown(ctx.update.callback_query.message.text) + '\n\n' +
        '✅ *Tasdiqlandi*\n' +
        '👤 Admin: ' + escapeMarkdown('@' + username) + '\n' +
        '🕒 Sana: ' + escapeMarkdown(new Date().toLocaleString()),
        { parse_mode: 'MarkdownV2' }
      );
    } catch (editError) {
      console.error('Xabarni yangilashda xatolik:', editError);
      await ctx.answerCbQuery('✅ To\'lov tasdiqlandi (xabarni yangilab bo\'lmadi)');
    }
    
    // Foydalanuvchiga xabar
    try {
      const userBalance = getUserBalance(userId);
      const userMessage = '✅ *To\'lov tasdiqlandi\!*\n\n' +
        '💰 Summa: ' + escapeMarkdown(amount.toLocaleString()) + ' so\'m\n' +
        '💳 Yangi balans: ' + escapeMarkdown(userBalance.toLocaleString()) + ' so\'m\n' +
        '🆔 Buyurtma ID: `' + paymentId + '`\n\n' +
        '📞 Murojaat uchun: @suxacyber';
      
      console.log('Foydalanuvchiga yuborilayotgan xabar:', {
        userId,
        message: userMessage,
        balance: userBalance
      });

      // 1-usul: Oddiy xabar yuborish
      try {
        const sentMessage = await ctx.telegram.sendMessage(
          userId,
          userMessage,
          { parse_mode: 'MarkdownV2' }
        );
        console.log('Xabar muvaffaqiyatli yuborildi:', sentMessage);
      } catch (sendError) {
        console.error('1-usul: Xabar yuborishda xatolik:', sendError);
        
        // 2-usul: Boshqa formatda yuborishga harakat qilamiz
        try {
          const simpleMessage = '✅ To\'lovingiz tasdiqlandi!\n\n' +
            '💰 Summa: ' + amount.toLocaleString() + ' so\'m\n' +
            '💳 Yangi balans: ' + userBalance.toLocaleString() + ' so\'m\n' +
            '🆔 Buyurtma ID: ' + paymentId + '\n\n' +
            '📞 Murojaat uchun: @suxacyber';
            
          await ctx.telegram.sendMessage(userId, simpleMessage);
          console.log('2-usul: Oddiy formatdagi xabar yuborildi');
        } catch (simpleError) {
          console.error('2-usul ham ishlamadi:', simpleError);
          throw simpleError; // Xatolikni yuqoriga yuboramiz
        }
      }
      
    } catch (error) {
      console.error('Foydalanuvchiga xabar yuborishda xatolik:', error);
      // Notify admin about the error
      try {
        await ctx.telegram.sendMessage(
          ADMIN_IDS[0],
          '⚠️ Xatolik: Foydalanuvchiga tasdiqlash xabarini yuborib bo\'lmadi\n' +
          'Buyurtma ID: `' + paymentId + '`\n' +
          'Foydalanuvchi ID: ' + userId + '\n' +
          'Xatolik: ' + escapeMarkdown(error.message || 'Noma\'lum xatolik'),
          { parse_mode: 'MarkdownV2' }
        );
      } catch (e) {
        console.error('Adminlarga xabar yuborishda xatolik:', e);
      }
    }
    
  } catch (error) {
    console.error('To\'lovni tasdiqlashda xatolik:', error);
    try {
      await ctx.answerCbQuery('❌ Xatolik yuz berdi!');
    } catch (e) {}
    
    // Notify admin about the error
    try {
      await ctx.telegram.sendMessage(
        ADMIN_IDS[0],
        '⚠️ Xatolik: To\'lovni tasdiqlashda muammo yuz berdi\n' +
        'Buyurtma ID: `' + paymentId + '`\n' +
        'Foydalanuvchi ID: ' + userId + '\n' +
        'Xatolik: ' + escapeMarkdown(error.message || 'Noma\'lum xatolik'),
        { parse_mode: 'MarkdownV2' }
      );
    } catch (e) {
      // If we can't send message to admin, there's not much we can do
    }
  }
});

// Admin tomonidan to'lovni rad etish
bot.action(/reject_payment:(\w+):(\d+)/, async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.answerCbQuery('Ruxsat yo\'q!');
    return;
  }
  
  const paymentId = ctx.match[1];
  const userId = parseInt(ctx.match[2]);
  const username = ctx.from.username || 'noma\'lum admin';
  
  try {
    // Adminlarga xabar
    await ctx.answerCbQuery('❌ To\'lov rad etildi!');
    await ctx.editMessageText(
      `${ctx.update.callback_query.message.text}\n\n` +
      `❌ *Rad etildi*\n` +
      `👤 Admin: @${username}\n` +
      `🕒 Sana: ${new Date().toLocaleString()}`,
      { parse_mode: 'Markdown' }
    );
    
    // Foydalanuvchiga xabar
    try {
      await ctx.telegram.sendMessage(
        userId,
        '❌ *To\'lov rad etildi\!*\n\n' +
      '🆔 Buyurtma ID: `' + paymentId + '`\n' +
      '❌ Sabab: To\'lov ma\'lumotlari noto\'g\'ri yoki to\'lov amalga oshirilmagan\.\n\n' +
      'ℹ️ Iltimos, to\'lovni qayta amalga oshiring yoki @suxacyber ga murojaat qiling\.',
      { 
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback('💳 Qayta to\'lov qilish', 'topup:amount')],
            [Markup.button.callback('📞 Yordam', 'support')]
          ]
        }
      }
      );
    } catch (error) {
      // Don't log error to console, try to send a simpler message
      try {
        await ctx.telegram.sendMessage(
          userId,
          `❌ To'lov rad etildi! Iltimos, @suxacyber ga murojaat qiling.`,
          { parse_mode: 'Markdown' }
        );
      } catch (e) {
        // Notify admin about the error using escaped text
        await ctx.telegram.sendMessage(
          ADMIN_IDS[0],
          `⚠️ Xatolik: Foydalanuvchiga xabar yuborishda muammo yuz berdi.\nFoydalanuvchi ID: ${userId}`,
          { parse_mode: 'Markdown' }
        );
      }
    }
    
  } catch (error) {
    console.error('To\'lovni rad etishda xatolik:', error);
    try {
      await ctx.answerCbQuery('❌ Xatolik yuz berdi!');
      // Notify admin about the error using escaped text
      // Notify admin about the error
      await ctx.telegram.sendMessage(
        ADMIN_IDS[0],
        `⚠️ Xatolik: To'lovni rad etishda muammo yuz berdi.\nBuyurtma ID: ${paymentId}\nFoydalanuvchi ID: ${userId}`,
        { parse_mode: 'Markdown' }
      );
    } catch (e) {
      // If we can't send message to admin, there's not much we can do
    }
  }
});

// Matnli javoblar (Promokod va Admin panel)
// Promokod kiritish bosqichi
bot.action('use_promo', async (ctx) => {
  ctx.session.awaitingPromo = true;
  await ctx.reply('🔑 Promokodni kiriting:');
});

// Promokodni tekshirish
// Function to format card number with spaces (e.g., 8600 1234 5678 9012)
function formatCardNumber(number) {
  if (!number) return '';
  // Remove all non-digit characters
  const digits = number.replace(/\D/g, '');
  // Add space every 4 digits
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}

// Function to get formatted card information
function getCardInfo() {
  const cardInfo = {
    owner: process.env.CARD_OWNER || 'Mavjud emas',
    uzcard: process.env.UZCARD_NUMBER ? formatCardNumber(process.env.UZCARD_NUMBER) : 'Mavjud emas',
    humo: process.env.HUMO_NUMBER ? formatCardNumber(process.env.HUMO_NUMBER) : 'Mavjud emas'
  };
  
  cardInfo.formatted = `💳 *Karta ma'lumotlari*\n` +
    `👤 Egasi: ${cardInfo.owner}\n` +
    `💳 Uzcard: \`${cardInfo.uzcard}\`\n` +
    `💳 Humo: \`${cardInfo.humo}\``;
    
  return cardInfo;
}

// Function to get premium prices
function getPremiumPrices() {
  return {
    1: parseInt(process.env.PREMIUM_1_MONTH) || 50000,
    3: parseInt(process.env.PREMIUM_3_MONTHS) || 120000,
    6: parseInt(process.env.PREMIUM_6_MONTHS) || 200000,
    12: parseInt(process.env.PREMIUM_12_MONTHS) || 350000
  };
}

// Function to get stars prices
function getStarsPrices() {
  return {
    100: parseInt(process.env.STARS_100) || 10000,
    200: parseInt(process.env.STARS_200) || 19000
  };
}

// Function to get Free Fire diamond prices
function getFfPrices() {
  return {
    100: parseInt(process.env.FF_100) || 5000,
    200: parseInt(process.env.FF_200) || 9000,
    500: parseInt(process.env.FF_500) || 20000,
    1000: parseInt(process.env.FF_1000) || 38000,
    2000: parseInt(process.env.FF_2000) || 75000
  };
}

// Function to get PUBG Mobile PP prices
function getPpPrices() {
  return {
    50: parseInt(process.env.PP_50) || 10000,
    100: parseInt(process.env.PP_100) || 20000,
    200: parseInt(process.env.PP_200) || 40000,
    500: parseInt(process.env.PP_500) || 100000,
    1000: parseInt(process.env.PP_1000) || 200000,
    2000: parseInt(process.env.PP_2000) || 400000,
    3000: parseInt(process.env.PP_3000) || 600000,
    5000: parseInt(process.env.PP_5000) || 1000000,
    10000: parseInt(process.env.PP_10000) || 2000000,
    20000: parseInt(process.env.PP_20000) || 4000000,
    50000: parseInt(process.env.PP_50000) || 10000000,
    100000: parseInt(process.env.PP_100000) || 20000000
  };
}

// Function to get PUBG Mobile UC prices
function getUcPrices() {
  return {
    60: parseInt(process.env.UC_60) || 10000,
    325: parseInt(process.env.UC_325) || 45000,
    660: parseInt(process.env.UC_660) || 85000,
    1800: parseInt(process.env.UC_1800) || 220000,
    3850: parseInt(process.env.UC_3850) || 450000,
    8100: parseInt(process.env.UC_8100) || 900000
  };
}
// Function to update price in .env
async function updatePrice(type, key, value) {
  try {
    // Format the environment variable name based on the type and key
    let envVar;
    if (type.toLowerCase() === 'premium') {
      const suffix = key === '1' ? '1_MONTH' : `${key}_MONTHS`;
      envVar = `PREMIUM_${suffix}`;
    } else if (type.toLowerCase() === 'stars') {
      envVar = `STARS_${key}`;
    } else if (type.toLowerCase() === 'ff') {
      envVar = `FF_${key}`;
    } else if (type.toLowerCase() === 'uc') {
      envVar = `UC_${key}`;
    } else {
      envVar = `${type.toUpperCase()}_${key}`;
    }
    
    console.log(`Updating ${envVar} to ${value}`);
    const updates = { [envVar]: value };
    
    try {
      const success = await updateEnvFile(updates);
      
      if (success) {
        // Force reload environment variables
        delete require.cache[require.resolve('dotenv')];
        require('dotenv').config();
        console.log(`Successfully updated ${envVar} in environment`);
        return true;
      }
      console.error(`Failed to update ${envVar} - updateEnvFile returned false`);
      return false;
    } catch (error) {
      console.error(`Error in updateEnvFile for ${envVar}:`, error);
      return false;
    }
  } catch (error) {
    console.error('Error in updatePrice:', error);
    return false;
  }
}

// Function to update .env file
function updateEnvFile(updates) {
  return new Promise((resolve, reject) => {
    try {
      const envPath = path.join(__dirname, '.env');
      
      // Read the file asynchronously
      fs.readFile(envPath, 'utf8', (err, data) => {
        if (err) {
          console.error('Error reading .env file:', err);
          return reject(err);
        }
        
        let envContent = data;
        let updated = false;
        
        // Update each key-value pair
        Object.entries(updates).forEach(([key, value]) => {
          // Escape special regex characters in the key
          const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`^${escapedKey}=.*`, 'm');
          
          if (envContent.match(regex)) {
            envContent = envContent.replace(regex, `${key}=${value}`);
          } else {
            // If key doesn't exist, add it to the end of the file
            if (envContent.endsWith('\n')) {
              envContent += `${key}=${value}`;
            } else {
              envContent += `\n${key}=${value}`;
            }
          }
          // Update process.env for current session
          process.env[key] = value;
          updated = true;
        });
        
        if (!updated) {
          console.log('No updates were made to .env file');
          return resolve();
        }
        
        // Write back to file asynchronously
        fs.writeFile(envPath, envContent, 'utf8', (err) => {
          if (err) {
            console.error('Error writing to .env file:', err);
            return reject(err);
          }
          console.log('Successfully updated .env file');
          resolve(true);
        });
      });
    } catch (error) {
      console.error('Error in updateEnvFile:', error);
      reject(error);
    }
  });
}

bot.on('text', async (ctx) => {
  // Check if admin is editing card info
  if (ctx.session.editingCardField) {
    const field = ctx.session.editingCardField;
    const value = ctx.message.text.trim();
    
    // Basic validation
    if ((field === 'UZCARD_NUMBER' || field === 'HUMO_NUMBER') && !/^\d+$/.test(value)) {
      await ctx.reply('❌ Noto\'g\'ri format! Faqat raqam kiriting.');
      return;
    }
    
    try {
      // Update the .env file
      updateEnvFile({ [field]: value });
      
      // Clear the editing state
      delete ctx.session.editingCardField;
      
      // Send success message and return to card menu
      await ctx.reply(`✅ ${field === 'CARD_OWNER' ? 'Karta egasi' : field === 'UZCARD_NUMBER' ? 'Uzcard raqami' : 'Humo raqami'} muvaffaqiyatli o'zgartirildi!`);
      
      // Show the updated card menu
      const cardInfoText = `💳 *Karta ma'lumotlari*\n` +
        `👤 Egasi: ${process.env.CARD_OWNER || 'Mavjud emas'}\n` +
        `💳 Uzcard: \`${process.env.UZCARD_NUMBER || 'Mavjud emas'}\`\n` +
        `💳 Humo: \`${process.env.HUMO_NUMBER || 'Mavjud emas'}\``;
        
      const cardMenuKeyboard = [
        [Markup.button.callback('✏️ Karta egasini o\'zgartirish', 'admin:editCardOwner')],
        [Markup.button.callback('💳 Uzcard raqamini o\'zgartirish', 'admin:editUzcard')],
        [Markup.button.callback('💳 Humo raqamini o\'zgartirish', 'admin:editHumo')],
        [Markup.button.callback('◀️ Orqaga', 'back:admin')]
      ];
      
      await sendOrUpdateMenu(ctx, cardInfoText, cardMenuKeyboard, { parse_mode: 'Markdown' });
      
    } catch (error) {
      console.error('Karta ma\'lumotlarini yangilashda xatolik:', error);
      await ctx.reply('❌ Xatolik yuz berdi. Iltimos qaytadan urinib ko\'ring.');
    }
    return;
  }
  
  // Check if admin is sending a message to a user
  if (ctx.session.awaitingUserMessage && ctx.session.messageTargetUser) {
    const targetUserId = ctx.session.messageTargetUser;
    const message = ctx.message.text;
    
    try {
      // Try to send the message to the user
      await ctx.telegram.sendMessage(
        targetUserId,
        `📨 *Admin xabari:*\n\n${message}\n\n` +
        `💬 Javob yozish uchun shu xabarga javob bosing.`,
        { parse_mode: 'Markdown' }
      );
      
      // Notify admin of success
      await ctx.reply(`✅ Xabar foydalanuvchiga muvaffaqiyatli yuborildi!`);
      
      // Clean up session
      delete ctx.session.awaitingUserMessage;
      delete ctx.session.messageTargetUser;
      
      // Go back to find user menu
      return sendAdminPanel(ctx);
      
    } catch (error) {
      console.error('Xabar yuborishda xatolik:', error);
      await ctx.reply('❌ Xabar yuborishda xatolik yuz berdi. Foydalanuvchi botni bloklagan yoki botni ishga tushirmagan bo\'lishi mumkin.');
      
      // Clean up session even if there was an error
      delete ctx.session.awaitingUserMessage;
      delete ctx.session.messageTargetUser;
      
      return sendAdminPanel(ctx);
    }
  }
  
  // Promokod kiritishni kutyapmiz
  if (ctx.session.awaitingPromo) {
    const promoCode = ctx.message.text.trim().toUpperCase();
    const userId = ctx.from.id;
    
    // Check if it's a command
    if (promoCode.startsWith('/')) {
      return;
    }
    
    const result = await checkPromoCode(promoCode);
    
    if (result.valid) {
      // Promokod to'g'ri bo'lsa, balansga qo'shamiz
      updateUserBalance(userId, result.amount);
      const used = markPromoCodeAsUsed(promoCode, userId);
      
      if (used) {
        // Foydalanuvchiga xabar beramiz
        await ctx.reply(result.message);
        
        // Yangilangan balansni ko'rsatamiz
        const userBalance = getUserBalance(userId);
        await ctx.reply(`💰 Joriy balans: ${userBalance.toLocaleString()} so'm`);
        
        // Adminlarga xabar beramiz
        const promo = promoCodeStorage.get(promoCode);
        const remainingUses = promo ? promo.usesLeft : 0;
        
        for (const adminId of ADMIN_IDS) {
          try {
            await ctx.telegram.sendMessage(
              adminId,
              `🎫 *Yangi Promokod Ishlatildi*\n\n` +
              `🔑 KOD: *${promoCode}*\n` +
              `👤 Foydalanuvchi: [${ctx.from.first_name}](tg://user?id=${userId}) (ID: ${userId})\n` +
              `💰 Summa: *${result.amount.toLocaleString()} so'm*\n` +
              `🔄 Qolgan foydalanish: *${remainingUses} marta*`,
              { parse_mode: 'Markdown' }
            );
          } catch (error) {
            console.error('Adminlarga xabar yuborishda xatolik:', error);
          }
        }
      } else {
        await ctx.reply('❌ Ushbu promokodni allaqachon ishlatgansiz!');
      }
    } else {
      await ctx.reply(result.message);
    }
    
    ctx.session.awaitingPromo = false;
    return;
  }
  // Check if user is in the process of buying UC/PP
  if (ctx.session.buying && (ctx.session.buying.type === 'pubg_uc' || ctx.session.buying.type === 'pubg_pp')) {
    const { type, amount, price } = ctx.session.buying;
    const username = ctx.message.text.trim();
    const productType = type === 'pubg_uc' ? 'UC' : 'PP';
    const orderId = generateOrderId();
    const userId = ctx.from.id;
    const userBalance = getUserBalance(userId);
    
    // Verify user still has enough balance
    if (userBalance < price) {
      const neededAmount = price - userBalance;
      const keyboard = [
        [Markup.button.callback('💳 Hisobni to\'ldirish', 'topup:amount')],
        [Markup.button.callback('⬅️ Orqaga', `pubg:buy_${type.split('_')[1]}`)]
      ];
      
      return sendOrUpdateMenu(
        ctx,
        `⚠️ *Hisobingizda yetarli mablag' mavjud emas!*\n\n` +
        `💳 Sizning balansingiz: *${userBalance.toLocaleString()} so'm*\n` +
        `💰 Tanlangan paket narxi: *${price.toLocaleString()} so'm*\n` +
        `💵 Yetishmayotgan summa: *${neededAmount.toLocaleString()} so'm*\n\n` +
        `ℹ Iltimos, hisobingizni to'ldiring yoki kichikroq miqdordagi ${productType} tanlang.`,
        keyboard
      );
    }
    
    // Create order object
    const order = {
      type,
      amount,
      price,
      username,
      userId,
      userName: ctx.from.first_name,
      status: 'pending',
      createdAt: new Date()
    };
    
    // Initialize orders object if it doesn't exist
    if (!ctx.session.orders) {
      ctx.session.orders = {};
    }
    
    // Store order in a global object instead of session
    if (!global.orders) {
      global.orders = {};
    }
    
    // Store order with all necessary details
    global.orders[orderId] = {
      ...order,
      orderId: orderId,
      userName: ctx.from.first_name,
      userId: ctx.from.id,
      timestamp: new Date().toISOString(),
      status: 'pending'
    };
    
    // Also store in session for reference
    if (!ctx.session.myOrders) {
      ctx.session.myOrders = [];
    }
    ctx.session.myOrders.push(orderId);
    
    // Clear buying state
    ctx.session.buying = null;
    
    // Send confirmation to user
    await ctx.replyWithMarkdown(
      `✅ Sotib olish so'rovi qabul qilindi!\n\n` +
      `📦 Mahsulot: *${amount} ${productType}*\n` +
      `👤 O'yinchi: *${username}*\n` +
      `💳 To'lov: *${price.toLocaleString()} so'm*\n` +
      `💰 Joriy balans: *${userBalance.toLocaleString()} so'm*\n\n` +
      `🆔 Buyurtma raqami: *${orderId}*\n` +
      `📞 Aloqa: @suxacyber\n\n` +
      `💡 Iltimos, to'lovni tasdiqlash uchun adminlarimiz kuting.`,
      { parse_mode: 'Markdown' }
    );
    
    // Notify admin
    const adminMessage = `🆕 *Yangi PUBG ${productType} Sotuv!*\n\n` +
      `🆔 Buyurtma: #${orderId}\n` +
      `👤 Foydalanuvchi: [${ctx.from.first_name}](tg://user?id=${ctx.from.id}) (ID: ${ctx.from.id})\n` +
      `📱 O'yinchi: *${username}*\n` +
      `📦 Miqdor: *${amount} ${productType}*\n` +
      `💵 Narx: *${price.toLocaleString()} so'm*\n` +
      `💰 Balans: *${userBalance.toLocaleString()} so'm*\n` +
      `⏰ Vaqt: ${new Date().toLocaleString()}`;
    
    // Send to all admins
    for (const adminId of ADMIN_IDS) {
      try {
        await bot.telegram.sendMessage(adminId, adminMessage, { 
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Tasdiqlash', callback_data: `confirm_pubg:${orderId}:${ctx.from.id}` },
                { text: '❌ Bekor qilish', callback_data: `reject_pubg:${orderId}:${ctx.from.id}` }
              ]
            ]
          }
        });
      } catch (err) {
        console.error(`Failed to send message to admin ${adminId}:`, err);
      }
    }
    
    // Reset session
    ctx.session.buying = null;
    return sendMainMenu(ctx);
  }

  if (ctx.session.awaitingPromo) {
    const code = ctx.message.text.trim();
    ctx.session.awaitingPromo = false;
    // Kodni tekshirish yoki bazaga yozish mumkin
    await ctx.reply(`Promokod qabul qilindi: ${code}`);
    return; // to'xtatamiz
  }

  // Admin: yangi promokod
  if (ctx.session.awaitingNewPromo && isAdmin(ctx)) {
    ctx.session.awaitingNewPromo = false;
    const promo = ctx.message.text.trim();
    // Promokodni saqlash yoki qo'shimcha amallar
    await ctx.reply(`Yangi promokod yaratildi: ${promo}`);
    return;
  }
  // Admin: foydalanuvchi izlash
  if (ctx.session.awaitingFindUser && isAdmin(ctx)) {
    const query = ctx.message.text.trim().toLowerCase();
    ctx.session.awaitingFindUser = false;
    
    try {
      // Try to find user by ID
      let foundUser = null;
      let foundBy = '';
      
      // Check if query is a user ID
      if (/^\d+$/.test(query)) {
        const userId = parseInt(query);
        try {
          const user = await ctx.telegram.getChat(userId);
          foundUser = user;
          foundBy = 'ID';
        } catch (error) {
          // User not found by ID, will search by name/username
        }
      }
      
      // Search for all matching users by username or name
      const allUsers = Array.from(global.botUsers || []);
      const matchingUsers = [];
      
      // If we found by ID, add it to results
      if (foundUser) {
        matchingUsers.push(foundUser);
      }
      
      // Search through all users for matches
      for (const userId of allUsers) {
        try {
          // Skip if this is the user we already found by ID
          if (foundUser && foundUser.id === userId) continue;
          
          const user = await ctx.telegram.getChat(userId);
          const usernameMatch = user.username && user.username.toLowerCase().includes(query);
          const firstNameMatch = user.first_name && user.first_name.toLowerCase().includes(query);
          const lastNameMatch = user.last_name && user.last_name.toLowerCase().includes(query);
          
          if (usernameMatch || firstNameMatch || lastNameMatch) {
            matchingUsers.push(user);
          }
        } catch (error) {
          console.error(`Foydalanuvchi ma'lumotlarini olishda xatolik (${userId}):`, error);
        }
        
        // Small delay to avoid hitting rate limits
        await new Promise(resolve => setTimeout(resolve, 30));
      }
      
      if (matchingUsers.length > 0) {
        if (matchingUsers.length === 1) {
          // If only one user found, show detailed info
          const user = matchingUsers[0];
          const userId = user.id;
          const userBalance = getUserBalance(userId) || 0;
          
          // Get user's orders count
          const userOrders = global.orders ? 
            Object.values(global.orders).filter(o => o.userId === userId) : [];
          const completedOrders = userOrders.filter(o => o.status === 'completed');
          
          const userInfo = `👤 *Foydalanuvchi ma\'lumotlari*\n\n` +
            `🆔 ID: \`${userId}\`\n` +
            `👤 Ism: ${user.first_name || 'Mavjud emas'} ${user.last_name || ''}\n` +
            `🔗 Username: @${user.username || 'mavjud emas'}\n` +
            `💰 Balans: *${userBalance.toLocaleString()} so'm*\n` +
            `📅 Buyurtmalar: ${completedOrders.length} ta (${userOrders.length} jami)\n` +
            `📊 Umumiy xarajat: ${completedOrders.reduce((sum, o) => sum + (o.price || 0), 0).toLocaleString()} so'm\n\n` +
            `🔍 _Ma\'lumotlar faqat ko'rish uchun_`;
          
          // No interactive buttons, just show the info
          const keyboard = [
            [Markup.button.callback('◀️ Orqaga', 'admin:findUser')]
          ];
          
          // Send the message only to the admin who searched
          if (ctx.chat && ctx.chat.id === ctx.from.id) {
            await sendOrUpdateMenu(ctx, userInfo, keyboard, { 
              parse_mode: 'Markdown',
              disable_web_page_preview: true
            });
          }
        } else {
          // If multiple users found, show list
          let userList = `🔍 *Topilgan foydalanuvchilar (${matchingUsers.length} ta)*\n\n`;
          const userButtons = [];
          
          // Add up to 10 matching users
          for (let i = 0; i < Math.min(matchingUsers.length, 10); i++) {
            const user = matchingUsers[i];
            const userBalance = getUserBalance(user.id) || 0;
            const displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Noma\'lum';
            const username = user.username ? `@${user.username}` : 'Noma\'lum';
            
            userList += `👤 *${i+1}.* ${displayName}\n` +
                       `   🔹 ${username} | ${userBalance.toLocaleString()} so'm\n` +
                       `   🔹 ID: \`${user.id}\`\n\n`;
            
            // Add a button for each user
            userButtons.push([
              Markup.button.callback(
                `👤 ${displayName} (${userBalance.toLocaleString()} so'm)`, 
                `admin:view_user:${user.id}`
              )
            ]);
          }
          
          if (matchingUsers.length > 10) {
            userList += `\n...va yana ${matchingUsers.length - 10} ta foydalanuvchi topildi.\n`;
            userList += `Qidiruvni aniqroq qiling.`;
          }
          
          // Add back button
          keyboard.push([Markup.button.callback('◀️ Orqaga', 'admin:findUser')]);
          
          await sendOrUpdateMenu(ctx, userList, keyboard);
        }
      } else {
        await sendOrUpdateMenu(
          ctx,
          `❌ Foydalanuvchi topilmadi\n\n"${query}" bo'yicha hech qanday foydalanuvchi topilmadi.`,
          [
            [Markup.button.callback('🔄 Qayta urinish', 'admin:findUser')],
            [Markup.button.callback('◀️ Orqaga', 'back:admin')]
          ]
        );
      }
    } catch (error) {
      console.error('Foydalanuvchi qidirishda xatolik:', error);
      await ctx.reply('❌ Xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring.');
      await sendAdminPanel(ctx);
    }
    return;
  }
  // Handle promo code creation
  if (ctx.session.creatingPromo) {
    // Skip if it's a command
    if (ctx.message.text.startsWith('/')) {
      return next();
    }
    
    const { step, data } = ctx.session.creatingPromo;
    const text = ctx.message.text.trim();
    
    if (step === 'amount') {
      const amount = parseInt(text);
      if (isNaN(amount) || amount <= 0) {
        await ctx.reply('❌ Noto\'g\'ri summa kiritildi. Iltimos, musbat son kiriting:');
        return;
      }
      
      data.amount = amount;
      ctx.session.creatingPromo.step = 'uses';
      
      await sendOrUpdateMenu(
        ctx,
        `💰 *Summa: ${amount.toLocaleString()} so'm*\n\n` +
        `🔄 Promo kod nechi marta ishlatilishi mumkin?\n` +
        `Iltimos, foydalanishlar sonini kiriting yoki tanlang:`, 
        [
          [Markup.button.callback('1 marta', 'setPromoUses:1')],
          [Markup.button.callback('5 marta', 'setPromoUses:5')],
          [Markup.button.callback('10 marta', 'setPromoUses:10')],
          [Markup.button.callback('◀️ Orqaga', 'admin:promoMenu')]
        ],
        { parse_mode: 'Markdown' }
      );
      return;
    } else if (step === 'uses') {
      const uses = parseInt(text);
      if (isNaN(uses) || uses <= 0) {
        await ctx.reply('❌ Noto\'g\'ri son kiritildi. Iltimos, musbat son kiriting:');
        return;
      }
      
      data.uses = uses;
      ctx.session.creatingPromo.step = 'expiry';
      
      await sendOrUpdateMenu(
        ctx,
        `🔄 *Foydalanishlar soni: ${uses} marta*\n\n` +
        `📅 Promo kod qancha kunga amal qiladi?\n` +
        `Iltimos, muddatni kiriting yoki tanlang:`, 
        [
          [Markup.button.callback('1 kun', 'setPromoExpiry:1')],
          [Markup.button.callback('7 kun', 'setPromoExpiry:7')],
          [Markup.button.callback('30 kun', 'setPromoExpiry:30')],
          [Markup.button.callback('◀️ Orqaga', 'admin:promoMenu')]
        ],
        { parse_mode: 'Markdown' }
      );
      return;
    } else if (step === 'expiry') {
      const days = parseInt(text);
      if (isNaN(days) || days <= 0) {
        await ctx.reply('❌ Noto\'g\'ri kun soni kiritildi. Iltimos, musbat son kiriting:');
        return;
      }
      
      data.expiresInDays = days;
      
      const { amount, uses } = data;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + days);
      
      await sendOrUpdateMenu(
        ctx,
        `✅ *Promo kod ma\'lumotlari*\n\n` +
        `💰 Summa: *${amount.toLocaleString()} so'm*\n` +
        `🔄 Foydalanish: *${uses} marta*\n` +
        `📆 Amal qilish muddati: *${days} kun*\n` +
        `📅 Tugash sanasi: *${expiresAt.toLocaleDateString()}*\n\n` +
        `Promo kodni yaratishni tasdiqlaysizmi?`,
        [
          [Markup.button.callback('✅ Tasdiqlash', 'admin:confirmPromo')],
          [Markup.button.callback('❌ Bekor qilish', 'admin:promoMenu')]
        ],
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    await ctx.reply('❌ Noto\'g\'ri miqdor kiritildi. Iltimos, musbat son kiriting.');
    return;
  }
  
  // Admin: broadcast
  if (ctx.session.awaitingBroadcast && ctx.session.broadcastState?.step === 'awaiting_message' && isAdmin(ctx)) {
    const broadcastText = ctx.message.text;
    
    // Store the broadcast message in session
    ctx.session.broadcastState = {
      step: 'confirm_send',
      message: broadcastText,
      messageIds: {}
    };
    
    // Show confirmation with cancel button
    const keyboard = [
      [
        Markup.button.callback('✅ Xabarni yuborish', 'confirm_broadcast'),
        Markup.button.callback('❌ Bekor qilish', 'cancel_broadcast')
      ]
    ];
    
    await sendOrUpdateMenu(
      ctx,
      `📝 *Xabar matni:*\n\n${broadcastText}\n\n` +
      `Ushbu xabarni barcha foydalanuvchilarga yuborishni tasdiqlaysizmi?`,
      keyboard
    );
    
    return;
  }
  
  return next();
});

// Obunani tekshirish
bot.action('check_subscription', async (ctx) => {
  try {
    const isSubscribed = await checkUserSubscription(ctx);
    
    if (isSubscribed) {
      await ctx.answerCbQuery('✅ Siz barcha kanallarga obuna bo\'lgansiz!');
      return await sendMainMenu(ctx);
    } else {
      await ctx.answerCbQuery('❌ Iltimos, barcha kanallarga obuna bo\'ling!');
      return await sendSubscriptionMessage(ctx);
    }
  } catch (error) {
    console.error('Obunani tekshirishda xatolik:', error);
    await ctx.answerCbQuery('❌ Xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring.');
  }
});

// Har bir xabar uchun obunani tekshirish
bot.use(async (ctx, next) => {
  // Agar bu obunani tekshirish yoki kanalga o'tish bo'lsa, o'tkazib yuboramiz
  if (ctx.callbackQuery?.data === 'check_subscription' || 
      ctx.callbackQuery?.data?.startsWith('http')) {
    return next();
  }
  
  // Agar admin bo'lsa, tekshirmaymiz
  if (isAdmin(ctx)) {
    return next();
  }
  
  // Obunani tekshirish
  const isSubscribed = await checkUserSubscription(ctx);
  
  if (!isSubscribed) {
    // Agar obuna bo'lmagan bo'lsa, obuna bo'lish sahifasiga yo'naltiramiz
    return await sendSubscriptionMessage(ctx);
  }
  
  // Aks holda keyingi middlewarega o'tamiz
  return next();
});

// Kanal ma'lumotlarini o'qish
function getChannels() {
  const channels = [];
  let i = 1;
  
  while (process.env[`CHANNEL_${i}_USERNAME`] && process.env[`CHANNEL_${i}_LINK`]) {
    channels.push({
      username: process.env[`CHANNEL_${i}_USERNAME`].replace('@', ''), // @ belgisini olib tashlaymiz
      link: process.env[`CHANNEL_${i}_LINK`]
    });
    i++;
  }
  
  return channels;
}

// Foydalanuvchi kanallarga obuna bo'lganligini tekshirish
const checkUserSubscription = async (ctx) => {
  try {
    const userId = ctx.from.id;
    const channels = getChannels();
    
    // Agar kanallar mavjud bo'lmasa, obunani tekshirish shart emas
    if (channels.length === 0) {
      console.log('Obunani tekshirish o\'chirilgan - kanallar mavjud emas');
      return true;
    }
    
    for (const channel of channels) {
      try {
        // Kanal username orqali chat ma'lumotlarini olamiz
        const chat = await ctx.telegram.getChat(`@${channel.username}`);
        const member = await ctx.telegram.getChatMember(chat.id, userId);
        
        if (!['member', 'administrator', 'creator'].includes(member.status)) {
          console.log(`Foydalanuvchi ${userId} @${channel.username} kanaliga obuna emas`);
          return false; // Obuna bo'lmagan
        }
      } catch (error) {
        console.error(`Kanalni tekshirishda xatolik (@${channel.username}):`, error);
        // Agar kanal topilmasa yoki xatolik yuz bersa, shu kanalni o'tkazib yuboramiz
        continue;
      }
    }
    
    return true; // Barcha kanallarga obuna yoki kanallar mavjud emas
  } catch (error) {
    console.error('Obunani tekshirishda xatolik:', error);
    return true; // Xatolik bo'lsa ham foydalanuvchiga ruxsat beramiz
  }
};

// Obuna bo'lish tugmasi bilan xabar yuborish
const sendSubscriptionMessage = async (ctx) => {
  try {
    const channels = getChannels();
    
    // Agar kanallar mavjud bo'lmasa, asosiy menyuga qaytamiz
    if (channels.length === 0) {
      console.log('Obuna xabari yuborilmadi - kanallar mavjud emas');
      return await sendMainMenu(ctx);
    }
    
    const buttons = channels.map(channel => [
      Markup.button.url(`📢 ${channel.username} kanaliga obuna bo'lish`, channel.link)
    ]);
    
    buttons.push([Markup.button.callback('✅ Obunani tekshirish', 'check_subscription')]);
    
    await sendOrUpdateMenu(
      ctx,
      '⚠️ *Diqqat!*\n\n' +
      'Botdan foydalanish uchun quyidagi kanallarga obuna bo\'lishingiz kerak:',
      buttons
    );
  } catch (error) {
    console.error('Obuna xabarini yuborishda xatolik:', error);
    // Xatolik yuz berganda ham foydalanuvchiga tushunarli xabar qaytaramiz
    await ctx.reply('Kechirasiz, xatolik yuz berdi. Iltimos, keyinroq qayta urinib ko\'ring.');
    
    // Agar xatolik yuz bersa ham asosiy menyuni ko'rsatamiz
    try {
      await sendMainMenu(ctx);
    } catch (e) {
      console.error('Asosiy menyuni yuborishda xatolik:', e);
    }
  }
};

// Admin PUBG buyurtmasini tasdiqlash
bot.action(/confirm_pubg:(\w+):(\d+)/, async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.answerCbQuery('Ruxsat yo\'q!');
    return;
  }

  const orderId = ctx.match[1];
  const userId = parseInt(ctx.match[2]);
  
  try {
    // Get order details from database
    // const order = await getOrder(orderId);
    // if (!order) {
    //   return await ctx.answerCbQuery('Buyurtma topilmadi!');
    // }
    
    // Get order from global storage
    if (!global.orders || !global.orders[orderId]) {
      return await ctx.answerCbQuery('Buyurtma ma\'lumotlari topilmadi! Iltimos, foydalanuvchi qaytadan buyurtma bersin.');
    }
    
    const order = global.orders[orderId];
    
    // Check if order is already processed
    if (order.status === 'completed') {
      return await ctx.answerCbQuery('Bu buyurtma allaqachon bajarilgan!');
    }
    
    const { type, amount, price, username } = order;
    const productType = type === 'pubg_uc' ? 'UC' : 'PP';
    
    // Get current user balance
    const userBalance = getUserBalance(userId);
    
    // Check if user still has enough balance
    if (userBalance < price) {
      await ctx.answerCbQuery('Foydalanuvchida yetarli mablag\' mavjud emas!');
      return await ctx.editMessageText(
        `❌ *Balans yetarli emas!*\n` +
        `👤 Foydalanuvchi: [${order.userName || 'Noma\'lum'}](tg://user?id=${userId})\n` +
        `💰 Kerak: ${price.toLocaleString()} so'm\n` +
        `💳 Mavjud: ${userBalance.toLocaleString()} so'm\n` +
        `📦 Buyurtma: ${amount} ${productType}\n` +
        `🆔 Buyurtma: #${orderId}\n\n` +
        `❌ Iltimos, foydalanuvchiga xabar bering!`,
        { parse_mode: 'Markdown' }
      );
    }
    
    // Deduct balance
    updateUserBalance(userId, -price);
    
    // Update order status in global storage
    if (global.orders && global.orders[orderId]) {
      global.orders[orderId].status = 'completed';
      global.orders[orderId].completedAt = new Date().toISOString();
      global.orders[orderId].completedBy = ctx.from.id;
    }
    
    // Notify user
    await bot.telegram.sendMessage(
      userId,
      `✅ Sizning #${orderId} raqamli buyurtmangiz tasdiqlandi!\n\n` +
      `📦 Mahsulot: *${amount} ${productType}*\n` +
      `👤 O'yinchi: *${username}*\n` +
      `💳 To'lov: *${price.toLocaleString()} so'm*\n` +
      `💰 Qolgan balans: *${(userBalance - price).toLocaleString()} so'm*\n\n` +
      `📦 Buyurtmangiz tez orada yetkazib beriladi.\n` +
      `📞 Savollar bo'lsa: @suxacyber`,
      { parse_mode: 'Markdown' }
    );
    
    // Update admin message
    await ctx.answerCbQuery('✅ Buyurtma tasdiqlandi!');
    await ctx.editMessageText(
      `✅ *Buyurtma tasdiqlandi*\n` +
      `🆔 Buyurtma: #${orderId}\n` +
      `👤 Foydalanuvchi: [${order.userName || 'Noma\'lum'}](tg://user?id=${userId})\n` +
      `💰 Summa: ${price.toLocaleString()} so'm\n` +
      `📦 Miqdor: ${amount} ${productType}\n` +
      `👤 Admin: ${ctx.from.first_name}\n` +
      `⏰ Vaqt: ${new Date().toLocaleString()}`,
      { 
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [] } // Remove buttons after confirmation
      }
    );
    
    // Remove order from session
    if (ctx.session.orders && ctx.session.orders[orderId]) {
      delete ctx.session.orders[orderId];
    }
    
  } catch (error) {
    console.error('Tasdiqlashda xatolik:', error);
    await ctx.answerCbQuery('Xatolik yuz berdi!');
  }
});

// Admin PUBG buyurtmasini bekor qilish
bot.action(/reject_pubg:(\w+):(\d+)/, async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.answerCbQuery('Ruxsat yo\'q!');
    return;
  }

  const orderId = ctx.match[1];
  const userId = ctx.match[2];
  
  try {
    // Get order from global storage
    if (!global.orders || !global.orders[orderId]) {
      return await ctx.answerCbQuery('Buyurtma topilmadi!');
    }
    
    const order = global.orders[orderId];
    
    // Update order status in global storage
    if (global.orders[orderId]) {
      global.orders[orderId].status = 'rejected';
      global.orders[orderId].rejectedAt = new Date().toISOString();
      global.orders[orderId].rejectedBy = ctx.from.id;
    }
    
    // Notify user
    try {
      await bot.telegram.sendMessage(
        userId,
        `❌ Sizning #${orderId} raqamli buyurtmangiz bekor qilindi!\n` +
        `📦 Mahsulot: *${order.amount} ${order.type === 'pubg_uc' ? 'UC' : 'PP'}*\n` +
        `💰 Summa: *${order.price.toLocaleString()} so'm*\n` +
        `⏰ Sana: ${new Date().toLocaleString()}\n\n` +
        `ℹ Sabab: Admin tomonidan bekor qilindi\n` +
        `📞 Savollar bo'lsa: @suxacyber`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.error('Foydalanuvchiga xabar yuborishda xatolik:', error);
    }
    
    // Update admin message
    await ctx.answerCbQuery('✅ Buyurtma bekor qilindi!');
    await ctx.editMessageText(
      `❌ *Buyurtma bekor qilindi*\n` +
      `🆔 Buyurtma: #${orderId}\n` +
      `👤 Foydalanuvchi: [${order.userName || 'Noma\'lum'}](tg://user?id=${userId})\n` +
      `📦 Mahsulot: ${order.amount} ${order.type === 'pubg_uc' ? 'UC' : 'PP'}\n` +
      `💰 Summa: ${order.price.toLocaleString()} so'm\n` +
      `👤 Admin: ${ctx.from.first_name}\n` +
      `⏰ Vaqt: ${new Date().toLocaleString()}`,
      { 
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [] } // Remove buttons after rejection
      }
    );
  } catch (error) {
    console.error('Bekor qilishda xatolik:', error);
    await ctx.answerCbQuery('Xatolik yuz berdi!');
  }
});

// Admin buyurtmani tasdiqlash (inline button orqali)
bot.action(/confirm_order:(\w+)/, async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.answerCbQuery('Ruxsat yo\'q!');
    return;
  }
  
  const orderId = ctx.match[1];
  const order = pendingOrders[orderId];
  
  if (!order) {
    await ctx.answerCbQuery('Buyurtma topilmadi yoki allaqachon bajarilgan!');
    return;
  }
  
  const { userId, type, amount, username, price } = order;
  
  try {
    // Foydalanuvchi balansini tekshirish
    const userBalance = getUserBalance(userId);
    
    if (userBalance < price) {
      await ctx.reply(`❌ Xatolik! Foydalanuvchida yetarli mablag' yo'q.\n` +
        `Balans: ${userBalance.toLocaleString()} so'm\n` +
        `Kerak: ${price.toLocaleString()} so'm`);
      return;
    }
    
    // Balansdan pul yechish
    updateUserBalance(userId, -price);
    
    // Foydalanuvchiga xabar
    const userMessage = `✅ Sizning buyurtmangiz tasdiqlandi!\n\n` +
      `📦 Turi: ${type === 'premium' ? 'Telegram Premium' : 'Telegram Stars'}\n` +
      `🔢 Miqdor: ${amount} ${type === 'premium' ? 'oy' : 'stars'}\n` +
      `💰 Hisobingizdan yechildi: ${price.toLocaleString()} so'm\n\n` +
      `📝 Iltimos, kuting. Tez orada sizga yuboriladi.`;
    
    await ctx.telegram.sendMessage(userId, userMessage);
    
    // Buyurtmani o'chirish
    delete pendingOrders[orderId];
    
    await ctx.reply(`✅ Buyurtma tasdiqlandi va foydalanuvchi hisobidan ${price.toLocaleString()} so'm yechib olindi.`);
    
  } catch (error) {
    console.error('Buyurtmani tasdiqlashda xatolik:', error);
    await ctx.answerCbQuery('Xatolik yuz berdi: ' + error.message);
  }
});

// Admin buyurtmani bekor qilish (inline button orqali)
bot.action(/cancel_order:(\w+)/, async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.answerCbQuery('Ruxsat yo\'q!');
    return;
  }
  
  const orderId = ctx.match[1];
  const order = pendingOrders[orderId];
  
  if (!order) {
    await ctx.answerCbQuery('Buyurtma topilmadi!');
    return;
  }
  
  const { userId, type, amount, username, price } = order;
  
  try {
    // Foydalanuvchiga xabar
    await ctx.telegram.sendMessage(
      userId,
      `❌ Sizning buyurtmangiz bekor qilindi!\n\n` +
      `📦 Turi: ${type === 'premium' ? 'Telegram Premium' : 'Telegram Stars'}\n` +
      `🔢 Miqdor: ${amount} ${type === 'premium' ? 'oy' : 'stars'}\n` +
      `💰 Summa: ${price.toLocaleString()} so'm\n\n` +
      `ℹ️ Iltimos, qaytadan urinib ko'ring yoki admin bilan bog'laning.`
    );
    
    // Buyurtmani o'chirish
    delete pendingOrders[orderId];
    
    // Xabarni yangilash
    await ctx.editMessageText(
      `${ctx.update.callback_query.message.text}\n\n` +
      `❌ *Bekor qilindi*\n` +
      `👤 Admin: @${ctx.from.username || 'noma\'lum'}\n` +
      `🕒 Sana: ${new Date().toLocaleString()}`,
      { parse_mode: 'Markdown' }
    );
    
    await ctx.answerCbQuery('✅ Buyurtma bekor qilindi!');
  } catch (error) {
    console.error('Buyurtmani bekor qilishda xatolik:', error);
    await ctx.answerCbQuery('Xatolik yuz berdi!');
  }
});

// Admin buyurtmani bekor qilish (eski usul - command orqali)
bot.command(/cancel_(\w+)/, async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.reply('Sizda ruxsat yo\'q!');
    return;
  }
  
  const orderId = ctx.match[1];
  const order = pendingOrders[orderId];
  
  if (!order) {
    await ctx.reply('Buyurtma topilmadi!');
    return;
  }
  
  const { userId, type, amount, price } = order;
  
  try {
    // Foydalanuvchiga xabar
    await ctx.telegram.sendMessage(
      userId,
      `❌ Sizning buyurtmangiz bekor qilindi!\n\n` +
      `📦 Turi: ${type === 'premium' ? 'Telegram Premium' : 'Telegram Stars'}\n` +
      `🔢 Miqdor: ${amount} ${type === 'premium' ? 'oy' : 'stars'}\n` +
      `💰 Summa: ${price.toLocaleString()} so'm\n\n` +
      `ℹ️ Iltimos, qaytadan urinib ko'ring yoki admin bilan bog'laning.`
    );
    
    // Buyurtmani o'chirish
    delete pendingOrders[orderId];
    
    await ctx.reply('✅ Buyurtma bekor qilindi!');
  } catch (error) {
    console.error('Buyurtmani bekor qilishda xatolik:', error);
    await ctx.reply('Xatolik yuz berdi: ' + error.message);
  }
});

// Orqaga tugmasi bosilganda (asosiy menyuga qaytish)
bot.action('back:main', async (ctx) => {
  try {
    // Avvalgi xabarni o'chirishga harakat qilamiz
    try {
      await ctx.deleteMessage();
    } catch (e) {
      // Xatoni e'tiborsiz qoldiramiz
    }
    // Asosiy menyuni yuboramiz
    await sendMainMenu(ctx);
  } catch (error) {
    console.error('Orqaga qaytishda xatolik:', error);
  }
});

// Premium/Stars orqaga tugmasi (asosiy Premium/Stars menyusiga qaytish)
bot.action('back:premium_stars', async (ctx) => {
  try {
    const keyboard = [
      [Markup.button.callback('📱 Telegram Premium', 'premium:select')],
      [Markup.button.callback('⭐ Telegram Stars', 'stars:select')],
      [Markup.button.callback('⬅️ Asosiy menyu', 'back:main')]
    ];
    await sendOrUpdateMenu(ctx, 'Qaysi xizmatni sotib olmoqchisiz?', keyboard);
  } catch (error) {
    console.error('Premium/Stars orqaga qaytishda xatolik:', error);
  }
});

// Text message handler for price updates and card info
bot.on('text', async (ctx) => {
  // Handle PP price updates
  if (ctx.session.editingPpPrice) {
    const { amount } = ctx.session.editingPpPrice;
    const price = parseInt(ctx.message.text.trim());
    
    if (isNaN(price) || price <= 0) {
      await ctx.reply('❌ Iltimos, to\'g\'ri narx kiriting (faqat musbat sonlar)!');
      return;
    }
    
    // Update the price in .env
    try {
      const success = await updatePrice('pp', amount, price);
      
      if (success) {
        await ctx.reply(`✅ ${amount} PP narxi ${price.toLocaleString()} so'mga yangilandi!`);
        
        // Show the PP prices menu again with updated prices
        const ppPrices = getPpPrices();
        let ppText = '🎯 *PUBG Mobile PP Narxlari*\n\n';
        
        for (const [a, p] of Object.entries(ppPrices)) {
          ppText += `🔹 ${a} PP: ${p.toLocaleString()} so'm\n`;
        }
        
        const keyboard = [
          [Markup.button.callback('✏️ 50 PP', 'admin:editPrice:pp:50')],
          [Markup.button.callback('✏️ 100 PP', 'admin:editPrice:pp:100')],
          [Markup.button.callback('✏️ 200 PP', 'admin:editPrice:pp:200')],
          [Markup.button.callback('✏️ 500 PP', 'admin:editPrice:pp:500')],
          [Markup.button.callback('✏️ 1000 PP', 'admin:editPrice:pp:1000')],
          [Markup.button.callback('✏️ 2000 PP', 'admin:editPrice:pp:2000')],
          [Markup.button.callback('✏️ 3000 PP', 'admin:editPrice:pp:3000')],
          [Markup.button.callback('✏️ 5000 PP', 'admin:editPrice:pp:5000')],
          [Markup.button.callback('✏️ 10000 PP', 'admin:editPrice:pp:10000')],
          [Markup.button.callback('✏️ 20000 PP', 'admin:editPrice:pp:20000')],
          [Markup.button.callback('✏️ 50000 PP', 'admin:editPrice:pp:50000')],
          [Markup.button.callback('✏️ 100000 PP', 'admin:editPrice:pp:100000')],
          [Markup.button.callback('◀️ Orqaga', 'admin:priceMenu')]
        ];
        
        try {
          await ctx.reply(ppText, {
            reply_markup: { inline_keyboard: keyboard },
            parse_mode: 'Markdown'
          });
        } catch (error) {
          console.error('Error sending updated prices:', error);
          await ctx.reply('✅ Narx muvaffaqiyatli yangilandi!');
        }
      } else {
        await ctx.reply('❌ Narxni yangilashda xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring.');
      }
    } catch (error) {
      console.error('Error updating PP price:', error);
      await ctx.reply('❌ Xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring.');
    }
    
    // Clear the editing state
    delete ctx.session.editingPpPrice;
  }
  // Handle price updates
  if (ctx.session && ctx.session.editingPrice) {
    const { type, key } = ctx.session.editingPrice;
    const priceText = ctx.message.text.trim();
    
    // Validate price input
    const price = parseInt(priceText.replace(/\D/g, ''));
    if (isNaN(price) || price <= 0) {
      await ctx.reply('❌ Iltimos, to\'g\'ri summa kiriting!');
      return;
    }
    
    try {
      // Show typing action to indicate processing
      await ctx.telegram.sendChatAction(ctx.chat.id, 'typing');
      
      // Update the price
      const success = await updatePrice(type, key, price);
      
      if (!success) {
        throw new Error('Narxni yangilashda xatolik yuz berdi');
      }
      
      // Clear the editing state
      delete ctx.session.editingPrice;
      
      // Show success message
      let itemName = '';
      let backButton = 'admin:priceMenu';
      
      switch (type) {
        case 'stars':
          itemName = `${key} ta Stars`;
          backButton = 'admin:starsPrices';
          break;
        case 'premium':
          itemName = `${key} oylik Premium`;
          backButton = 'admin:premiumPrices';
          break;
        case 'uc':
          itemName = `${key} UC`;
          backButton = 'admin:ucPrices';
          break;
        case 'pp':
          itemName = `${key} PP`;
          backButton = 'admin:ppPrices';
          break;
        case 'ff':
          itemName = `${key} Diamond`;
          backButton = 'admin:ffPrices';
          break;
        default:
          itemName = `${key}`;
      }
      
      await ctx.reply(`✅ ${itemName} narxi ${price.toLocaleString()} so'mga yangilandi!`);
      
      // Return to the appropriate menu
      if (isAdmin(ctx)) {
        let keyboard = [];
        let menuText = '';
        
        switch (type) {
          case 'uc':
          case 'pp':
          case 'ff':
            // Game prices menu
            const ucPrices = getUcPrices();
            const ppPrices = getPpPrices();
            const ffPrices = getFfPrices();
            
            menuText = '🎮 *O\'yin narxlari*\n\n';
            
            menuText += '🎮 *PUBG UC Narxlari*\n';
            for (const [amount, price] of Object.entries(ucPrices)) {
              menuText += `🔹 ${amount} UC: ${price.toLocaleString()} so'm\n`;
            }
            
            menuText += '\n🎖️ *PUBG PP Narxlari*\n';
            for (const [amount, price] of Object.entries(ppPrices)) {
              menuText += `🔹 ${amount} PP: ${price.toLocaleString()} so'm\n`;
            }
            
            menuText += '\n🔥 *Free Fire Diamond Narxlari*\n';
            for (const [amount, price] of Object.entries(ffPrices)) {
              menuText += `🔹 ${amount} Diamond: ${price.toLocaleString()} so'm\n`;
            }
            
            keyboard = [
              [
                Markup.button.callback('✏️ PUBG UC', 'admin:ucPrices'),
                Markup.button.callback('✏️ PUBG PP', 'admin:ppPrices')
              ],
              [
                Markup.button.callback('✏️ Free Fire', 'admin:ffPrices')
              ],
              [
                Markup.button.callback('◀️ Orqaga', 'admin:priceMenu')
              ]
            ];
            break;
            
          case 'stars':
          case 'premium':
          default:
            // Premium/Stars menu
            const starsPrices = getStarsPrices();
            const premiumPrices = getPremiumPrices();
            
            menuText = '💰 *Barcha narxlar*\n\n';
            
            menuText += '⭐ *Stars narxlari*\n';
            for (const [count, price] of Object.entries(starsPrices)) {
              menuText += `🔹 ${count} ta: ${price.toLocaleString()} so'm\n`;
            }
            
            menuText += '\n🎖️ *Premium narxlari*\n';
            for (const [months, price] of Object.entries(premiumPrices)) {
              menuText += `🔹 ${months} oy: ${price.toLocaleString()} so'm\n`;
            }
            
            keyboard = [
              [
                Markup.button.callback('✏️ Stars', 'admin:starsPrices'),
                Markup.button.callback('✏️ Premium', 'admin:premiumPrices')
              ],
              [
                Markup.button.callback('✏️ PUBG UC', 'admin:ucPrices'),
                Markup.button.callback('✏️ PUBG PP', 'admin:ppPrices')
              ],
              [
                Markup.button.callback('✏️ Free Fire', 'admin:ffPrices')
              ],
              [
                Markup.button.callback('◀️ Orqaga', 'back:admin')
              ]
            ];
        }
        
        await ctx.telegram.sendMessage(
          ctx.chat.id, 
          menuText, 
          {
            reply_markup: { inline_keyboard: keyboard },
            parse_mode: 'Markdown'
          }
        );
      }
    } catch (error) {
      console.error('Error updating price:', error);
      await ctx.reply('❌ Narxni yangilashda xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring.');
    }
    return;
  }
  
  // Handle card information updates
  if (ctx.session && ctx.session.editingCard) {
    const { field } = ctx.session.editingCard;
    
    // Validate input
    if (field === 'uzcard' || field === 'humo') {
      // Remove all non-digit characters
      const cardNumber = ctx.message.text.replace(/\D/g, '');
      
      if (cardNumber.length < 16) {
        await ctx.reply('❌ Karta raqami 16 ta raqamdan iborat bo\'lishi kerak!');
        return;
      }
      
      // Update the card number with proper formatting
      await updateEnvFile({ [field === 'uzcard' ? 'UZCARD_NUMBER' : 'HUMO_NUMBER']: cardNumber });
      await ctx.reply(`✅ ${field === 'uzcard' ? 'Uzcard' : 'Humo'} raqami yangilandi!`);
    } else if (field === 'owner') {
      // Update card owner name
      await updateEnvFile({ CARD_OWNER: ctx.message.text });
      await ctx.reply('✅ Karta egasi ismi yangilandi!');
    }
    
    // Clear the editing state
    delete ctx.session.editingCard;
    
    // Show the card menu again
    if (isAdmin(ctx)) {
      await showCardMenu(ctx);
    }
  }
});

// O'yin narxlari menyusi va handlerlari o'chirildi

bot.launch();

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
