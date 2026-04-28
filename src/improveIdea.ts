import OpenAI from "openai";
import * as readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
import fs from "fs/promises";
import { IMPROVE_IDEA_PROMPT } from "./prompts.js";
import { OPENAI_MODEL } from "./const.js";

const client = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'], // This is the default and can be omitted
});

const IDEA_DIVIDE_NUMBER = 30;

async function improveIdea(
  idea: string,
  currentCategories: string[],
  categories: string[],
  materialFeatures: string
): Promise<Record<string, any>> {
  try {
    console.log("Start idea : ", idea.slice(0, 30), "...");
    const response = await client.responses.create({
      model: OPENAI_MODEL,
      instructions: IMPROVE_IDEA_PROMPT,
      input: JSON.stringify({
        idea,
        currentCategories,
        newCategoryCandidates: categories,
        materialFeatures
      }),
    });
    const parsedJson = JSON.parse(response.output_text);
    if (typeof parsedJson !== "object" || parsedJson === null) {
      throw new Error("出力されたJSONがオブジェクト形式ではありません。");
    }
    console.log("End idea : ", idea.slice(0, 30), "...");
    return parsedJson;
  } catch (error) {
    console.error("LLMの応答の処理中にエラーが発生しました:", error);
    return {};
  }
}

async function improveIdeas(materialName: string, materialFeatures: string) {
  let categories: string[] = [];
  let ideas = [];
  let improvedIdeas: any[] = [];
  try {
    const path = `./json/${materialName}/categories.json`;
    const data = await fs.readFile(path, "utf-8");
    const categoriesJson = JSON.parse(data);
    if (Array.isArray(categoriesJson)) {
      categories = categoriesJson;
    }
  } catch (_) {
    console.error("カテゴリの読み込み中にエラーが発生しました:");
    return null;
  }
  try {
    const path = `./json/${materialName}/categorized_ideas_88.json`;
    const data = await fs.readFile(path, "utf-8");
    ideas = JSON.parse(data);
    if (!Array.isArray(ideas) || ideas.length === 0) {
      return [];
    }
  } catch (error) {
    console.error("アイデアの分類中にエラーが発生しました:", error);
    return null;
  }
  const totalIdeasDivide = Math.ceil(ideas.length / IDEA_DIVIDE_NUMBER);
  let dividedIdeas: any[][] = [];
  for (let i = 0; i < totalIdeasDivide /** 2 */; i++) {
    dividedIdeas.push(ideas.slice(i * IDEA_DIVIDE_NUMBER, (i + 1) * IDEA_DIVIDE_NUMBER));
  }
//   for (const ideaObj of ideas.slice(0, 10)) {
  for (const ideaGroup of dividedIdeas) {
    const results = await Promise.all(ideaGroup.map(async(ideaObj: any) => {
      const idea = ideaObj.idea;
      const currentCategories = ideaObj.categories || [];
      const filteredCurrentCategories = categories.filter((cat: string) => !currentCategories.includes(cat));
      const originalImprovedIdea = await improveIdea(idea, currentCategories, filteredCurrentCategories, materialFeatures);
      const improvedIdea = Object.fromEntries(Object.entries(originalImprovedIdea).sort(([, a], [, b]) => b.additionalIdeaScore - a.additionalIdeaScore));
      const over70 = Object.entries(improvedIdea).filter(([_, value]) => value.additionalIdeaScore >= 70).length;
      const over80 = Object.entries(improvedIdea).filter(([_, value]) => value.additionalIdeaScore >= 80).length;
      console.log(`Idea: ${idea.slice(0, 30)}..., Over 70: ${over70}, Over 80: ${over80}`);
      return { ...ideaObj, ...improvedIdea, over70, over80 };
    }));
    improvedIdeas.push(...results);
    try {
      fs.writeFile(`./json/${materialName}/improved_ideas_88.json`, JSON.stringify(improvedIdeas, null, 2), "utf-8");
    } catch(error) {
      console.error(error);
    }
  }
  try {
    fs.writeFile(`./json/${materialName}/improved_ideas_88.json`, JSON.stringify(improvedIdeas, null, 2), "utf-8");
  } catch(error) {
    console.error(error);
  }
}

async function main() {
  console.log("\n\n応用したい素材の名前を入力してください\n\n");
  // get user input
  const rl1 = readline.createInterface({ input, output });
  let materialName: string = "";
  try {
    materialName = await rl1.question("素材の名前: ");
  } catch (error) {
    console.error("入力エラー:", error);
  } finally {
    rl1.close();
  }
  console.log("\n\n応用したい素材の特徴を入力してください\n\n");
  // get user input
  const rl3 = readline.createInterface({ input, output });
  let material: string = "";
  try {
    material = await rl3.question("素材の特徴: ");
  } catch (error) {
    console.error("入力エラー:", error);
  } finally {
    rl3.close();
  }
  await improveIdeas(materialName, material);
}

main();