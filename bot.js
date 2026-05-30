const { Telegraf } = require("telegraf");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

// ================= CONFIG =================
const BOT_TOKEN = process.env.BOT_TOKEN || "8916440261:AAEi2-0DNJdUnK1VHoA5BmlNLZCT4wRxGjs";
const BOT_USERNAME = process.env.BOT_USERNAME || "Instagram_free_reels_bundle_bot";
const SHRINK_API_KEY = process.env.SHRINK_API_KEY || "4e7386ac97c93f8b41c79bece5fa25bdf7e04cbe";
const YOUTUBE_TUTORIAL = process.env.YOUTUBE_TUTORIAL || "https://youtube.com/shorts/NUB7hSACZYk?si=2Mp8A6q-KwclQb62";

// ================= FILE PATHS =================
const BUNDLES_FILE = path.join(__dirname, "bundles.txt");
const USERS_FILE = path.join(__dirname, "users.txt");

// ================= DATABASE =================
let DB = [];
let USERS = [];

// ================= LOAD BUNDLES =================
if (fs.existsSync(BUNDLES_FILE)) {
  DB = fs.readFileSync(BUNDLES_FILE, "utf-8")
    .split("\n")
    .filter(Boolean)
    .map(l => {
      const [title, link] = l.split("|||");
      return { title, link };
    });
}

// ================= LOAD USERS =================
if (fs.existsSync(USERS_FILE)) {
  USERS = fs.readFileSync(USERS_FILE, "utf-8")
    .split("\n")
    .filter(Boolean)
    .map(l => {
      const [id, refBy, points] = l.split("|||");
      return { id, refBy, points: Number(points || 0) };
    });
}

// ================= SAVE USERS =================
function saveUsers() {
  fs.writeFileSync(
    USERS_FILE,
    USERS.map(u => `${u.id}|||${u.refBy || ""}|||${u.points}`).join("\n")
  );
}

// ================= SHRINKEARN SHORTENER =================
async function shortLink(url) {
  try {
    const api = `https://shrinkearn.com/api?api=${SHRINK_API_KEY}&url=${encodeURIComponent(url)}&format=text`;
    const res = await axios.get(api);
    return res.data && res.data.startsWith("http") ? res.data.trim() : url;
  } catch (err) {
    console.log("Short error:", err.message);
    return url;
  }
}

// ================= BOT =================
const bot = new Telegraf(BOT_TOKEN);

// ================= CHANNEL SAVE =================
bot.on("channel_post", (ctx) => {
  try {
    const text = ctx.channelPost.text;
    if (!text) return;

    const match = text.match(/https?:\/\/\S+/);
    if (!match) return;

    const link = match[0];
    const title = text.split(":")[0].trim();

    if (!DB.find(b => b.link === link)) {
      DB.push({ title, link });
      fs.writeFileSync(BUNDLES_FILE, DB.map(b => `${b.title}|||${b.link}`).join("\n"));
      console.log("Saved:", title);
    }
  } catch {}
});

// ================= START COMMAND =================
bot.start((ctx) => {
  const userId = String(ctx.from.id);
  const ref = ctx.startPayload;

  let user = USERS.find(u => u.id === userId);
  if (!user) {
    user = { id: userId, refBy: ref || "", points: 0 };
    USERS.push(user);

    if (ref && ref !== userId) {
      const refUser = USERS.find(u => u.id === ref);
      if (refUser) refUser.points += 1;
    }

    saveUsers();
  }

  user = USERS.find(u => u.id === userId);

  ctx.reply(
`👋 Hello ${ctx.from.first_name}!

🎬 Welcome to Ultimate Reels Bundle Bot

🔍 HOW TO USE:
1️⃣ Search bundles (Cars, Anime, Bollywood etc.)
2️⃣ Click bundle button
3️⃣ Unlock & enjoy reels instantly

💎 Your Points: ${user.points}

🎁 FREE SYSTEM:
1 Points = 1 Free Bundle (No Ads)

💰 MONETIZED SYSTEM:
Below 1 points = ShrinkEarn links

⚡ Tip: More referrals = more free bundles!`,
  {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "💎 Share & Earn Free Points",
            url: `https://t.me/share/url?url=https://t.me/${BOT_USERNAME}?start=${userId}&text=Join%20this%20bot%20and%20earn%20free%20reels%20bundles%20🔥`
          }
        ],
        [
          { text: "❓ How to Open Bundle", url: YOUTUBE_TUTORIAL }
        ]
      ]
    }
  });
});

// ================= SEARCH =================
bot.on("text", (ctx) => {
  const q = ctx.message.text.toLowerCase();
  const found = DB.filter(b => b.title.toLowerCase().includes(q));
  if (!found.length) return ctx.reply("❌ No bundle found");

  const buttons = found.map((b, i) => [
    { text: b.title.slice(0, 35), callback_data: `unlock_${i}` }
  ]);

  ctx.reply("📦 Bundles Found:", { reply_markup: { inline_keyboard: buttons } });
});

// ================= UNLOCK =================
bot.on("callback_query", async (ctx) => {
  const data = ctx.callbackQuery.data;
  if (!data.startsWith("unlock_")) return;

  const index = parseInt(data.split("_")[1]);
  const bundle = DB[index];
  if (!bundle) return ctx.answerCbQuery("Not found");

  const userId = String(ctx.from.id);
  let user = USERS.find(u => u.id === userId) || { id: userId, refBy: "", points: 0 };
  if (!USERS.includes(user)) USERS.push(user);

  ctx.answerCbQuery("Checking...");

  if (user.points >= 1) {
    user.points -= 1;
    saveUsers();
    return ctx.reply(
`🎁 FREE REWARD UNLOCKED

🔓 ${bundle.title}

💎 Used 1 Points (FREE ACCESS)

👉 ${bundle.link}`
    );
  }

  const short = await shortLink(bundle.link);
  ctx.reply(
    `🔓 ${bundle.title}\n\n💰 Powered by ShrinkEarn`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📥 Open Bundle", url: short }],
          [{ text: "❓ How to Open Bundle", url: YOUTUBE_TUTORIAL }]
        ]
      }
    }
  );
});

// ================= START BOT =================
bot.launch();
console.log("Bot Running 🚀");
