import { existsSync, readFileSync, writeFileSync } from "fs";

interface IPoll {
  date: Date;
  pollId: string;
  chatId: number;
  messageId: number;
  pollVotes: number;
  votesFromMessage: number;
}

export const PollMap = new Map<number, IPoll>();

const filename = "./polls.json";

export const savePollsToFile = () => {
  try {
    const data = Array.from(PollMap.entries());
    writeFileSync(filename, JSON.stringify(data, null, 2));
  } catch (error) {
    console.log("ERROR [savePollsToFile]:", error);
  }
};

const loadPollsFromFile = () => {
  try {
    if (!existsSync(filename)) {
      return;
    }

    const data = readFileSync(filename, "utf-8");
    const entries = JSON.parse(data) as [number, IPoll][];

    PollMap.clear();
    entries.forEach(([key, value]) => {
      PollMap.set(key, value);
    });
  } catch (error) {
    console.log("ERROR [loadPollsFromFile]:", error);
  }
};

loadPollsFromFile();
