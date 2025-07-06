import { Context } from "grammy";
import moment from "moment";
import schedule from "node-schedule";

import { bot } from "./bot.ts";
import { createPoll, receiveMessageVote, subscribePoll } from "./poll.ts";
import { PollMap } from "./pollsStorage.ts";

moment.locale("ru");

const running = new Set<number>();

let timerId: any = null;
let messagesCount = 0;

const NOT_ACCEPT_MESSAGE =
  "Братуха, я работаю только с командами!\n\nДобавь меня в свою группу, и я буду создавать и управлять опросами для сбора игроков каждый день в 12:00";

const runBot = async (ctx: Context) => {
  if (ctx.chat && ctx.chat.type === "supergroup") {
    if (ctx.chatId && !running.has(ctx.chatId)) {
      running.add(ctx.chatId);

      // Правило: каждый день в 12:00 по Москве
      const rule = new schedule.RecurrenceRule();
      rule.hour = 12; // 12 часов
      rule.minute = 0; // 0 минут
      rule.tz = "Europe/Moscow"; // Указываем часовой пояс

      // Ежедневно в 12:00 по Москве
      schedule.scheduleJob(rule, async () => {
        await createPoll(ctx);
      });
    }
  } else {
    await ctx.reply(NOT_ACCEPT_MESSAGE);
  }
};

const start = async () => {
  try {
    subscribePoll();

    bot.command("start", async ctx => {
      if (ctx.message) {
        await ctx.api.deleteMessage(ctx.chatId, ctx.message?.message_id);
      }

      await runBot(ctx);
    });

    bot.on("message", async ctx => {
      await runBot(ctx);

      if (ctx.chat.type === "supergroup") {
        await receiveMessageVote(ctx);

        const activePoll = PollMap.get(ctx.chatId);

        if (activePoll) {
          if (messagesCount > 10) {
            if (timerId) clearTimeout(timerId);

            timerId = setTimeout(
              async () => {
                if (activePoll) {
                  try {
                    await ctx.api.forwardMessage(
                      activePoll.chatId,
                      activePoll.chatId,
                      activePoll.messageId,
                    );
                    messagesCount = 0;
                  } catch {
                    //
                  }
                }
              },
              5 * 60 * 1000,
            );
          } else {
            messagesCount += 1;
          }
        }
      } else {
        await ctx.reply(NOT_ACCEPT_MESSAGE);
      }
    });

    bot
      .start({
        onStart: botInfo => {
          console.log(`Запущен бот – ${botInfo.username}`);
        },
      })
      .then();
  } catch (error) {
    console.log("Error [start]:", error);

    const timeout = 10000;
    console.log(`Перезапуск через ${timeout / 1000} сек.`);
    setTimeout(() => {
      start();
    }, timeout);
  }
};

start().then();
