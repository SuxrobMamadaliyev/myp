# Telegram O'zbekcha Bot

Ushbu loyiha oddiy inline tugmali Telegram bot bo'lib, barcha matnlar o'zbek tilida.

## O'rnatish

1. Node.js o'rnatilganligiga ishonch hosil qiling.
2. Reponi yuklab oling yoki papkani tanlang.
3. Terminalda quyidagilarni ishga tushiring:

```bash
npm install
```

4. Papka ichida `.env` fayli yarating va bot tokenini yozing:

```env
BOT_TOKEN=123456:ABCDEF...
```

5. Botni ishga tushirish:

```bash
npm start
```

## Foydalanish

Botga */start* yuboring. Asosiy menyuda quyidagi bo'limlar inline tugma sifatida ko'rinadi:

- Hisobim
- Pul ishlash
- TG Premium & Stars
- PUBG UC
- Free Fire Almaz
- Admen paneli
- Yordam

"Hisobim" bo'limida balans ko'rsatiladi va "💰 Pul kiritish" tugmasi Payme havolasiga olib boradi (demo URL: `https://payme.uz/example`). `Admen paneli` bo'limi hozircha hamma uchun ochiq; haqiqiy admin tekshiruvi kerak bo'lsa, kodga qo'shish mumkin.

## Qo'shimcha

- `bot.js` da Payme uchun haqiqiy URL ni `https://payme.uz/example` o'rniga qo'ying.
- Zarur bo'lsa, yangi bo'limlar va tugmalarni `MAIN_MENU` massiviga qo'shishingiz mumkin.
