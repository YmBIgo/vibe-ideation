import OpenAI from "openai";
import * as readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
import fs from "fs/promises";
import {CLASSIFY_IDEA_PROMPT} from "./prompts.js";
import { OPENAI_MODEL } from "./const.js";

const client = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'], // This is the default and can be omitted
});

async function categorizeIdea(idea: string, categories: string[], materialFeatures: string): Promise<string[]> {
  try {
    const response = await client.responses.create({
      model: OPENAI_MODEL,
      instructions: CLASSIFY_IDEA_PROMPT,
      input: JSON.stringify({
        idea,
        categories,
        materialFeatures
      }),
    });
    const parsedJson = JSON.parse(response.output_text);
    if (!Array.isArray(parsedJson)) {
      throw new Error("出力されたJSONが配列形式ではありません。");
    }
    return parsedJson;
  } catch (error) { 
    console.error("LLMの応答の処理中にエラーが発生しました:", error);
    return [];
  }
}

async function categorizeIdeas(materialName: string, materialFeatures: string) {
  let categories: string[] = [];
  let ideas = [];
  let categorizedIdeas: any[] = [];
  try {
    const path = `./json/${materialName}/categories.json`;
    const data = await fs.readFile(path, "utf-8");
    const categoriesJson = JSON.parse(data);
    if (Array.isArray(categoriesJson)) {
      categories = categoriesJson;
    }
  } catch (_) {
    console.error("カテゴリの読み込み中にエラーが発生しました:");
  }
  try {
    const path = `./json/${materialName}/severity_ideas_88.json`;
    const data = await fs.readFile(path, "utf-8");
    ideas = JSON.parse(data);
    if (!Array.isArray(ideas) || ideas.length === 0) {
      return [];
    }
  } catch (error) {
    console.error("アイデアの分類中にエラーが発生しました:", error);
  }
  for (const ideaObj of ideas) {
    const idea = ideaObj.idea;
    const ideaCategories = await categorizeIdea(idea, categories, materialFeatures);
    categories = Array.from(new Set([...categories, ...ideaCategories]));
    categorizedIdeas = [...categorizedIdeas, { ...ideaObj, categories: ideaCategories }];
    console.log("new Categories : ", categories)
    try {
      fs.writeFile(`./json/${materialName}/categorized_ideas_88.json`, JSON.stringify(categorizedIdeas, null, 2), "utf-8");
    } catch(error) {
      console.error(error);
    }
    try {
      fs.writeFile(`./json/${materialName}/categories.json`, JSON.stringify(categories, null, 2), "utf-8");
    } catch (error) {
      console.error(error);
    }
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
  await categorizeIdeas(materialName, material);
}

main();