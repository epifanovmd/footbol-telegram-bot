import { Bot } from "grammy";

const bot = new Bot("YOUR_BOT_TOKEN");

// Команда для создания опроса
bot.command("poll", async (ctx) => {
  await ctx.replyWithPoll({
    question: "Какой язык программирования лучший?",
    options: ["TypeScript", "Python", "Rust", "Go"],
    is_anonymous: false,
    allows_multiple_answers: true,
  });
});

bot.start();
console.log("Бот запущен...");
