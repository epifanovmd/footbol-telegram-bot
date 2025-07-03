import moment from "moment";
import schedule from "node-schedule";

import { bot } from "./bot.ts";
import {
  activePoll,
  createPoll,
  receiveMessageVote,
  subscribePoll,
} from "./poll.ts";

moment.locale("ru");

const running = new Set<number>();

let timerId: any = null;
let messagesCount = 0;

const startText = `Бот запущен... \n
Ежедневно в 12:00 будет создаваться опрос\n\n
Для учета игроков отсутствующих в группе ВО ВРЕМЯ 
голосования необходимо написать в  чат "Со мной +1"`;

const start = async () => {
  try {
    subscribePoll();

    bot.command("start", async ctx => {
      if (ctx.chatId) {
        if (!running.has(ctx.chatId)) {
          running.add(ctx.chatId);
          await createPoll(ctx);
          ctx.reply(`${moment().format("DD.MM.YYYY hh:mm")}`);
          // Ежедневно в 12:00
          schedule.scheduleJob("0 12 * * *", async () => {
            await createPoll(ctx);
          });

          await ctx.reply(startText);
        }
      }
    });

    bot.on("message", async ctx => {
      await receiveMessageVote(ctx);

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
