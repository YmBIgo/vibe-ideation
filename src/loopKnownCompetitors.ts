/***** 新素材の使い方を検索するPoC *****
 * 
 * Why?
 * - 新素材の使い方は今までどうやって見つけてきたか？
 *   -> 地道な現場のヒアリングや観察のみ
 *   -> とても時間がかかる
 * - 今は頭のいいLLMがいるので、DBさえ構築できればRAG的にLLMに聞けばいいのではないか？
 * 
 * What?
 * - 新素材の使い方を検索するためのDBを構築する
 * - そのDBをRAG的にLLMに聞いて、使い方を提案してもらう
 * 
 * How?
 * - DBは、json/products.jsonの製品をベースに構築する
 * - 製品の特徴を抽出して、DBに格納する
 * - LLMに聞くときは、製品の特徴をもとに、使い方を提案してもらう
 * 
 * 実装例
 * 0. 製品の動作の流れを抽出。動作の流れの各過程で、動作を担保できる素材の要件と素材の特徴を保存
 * 1. 動作の特徴を抽出して、それで一回製品の動作を絞り込み（回転、加熱など）
 * 2. 絞り込んだ製品の動作で、代替可能な素材を使っている製造ラインを抽出
 * 3. 抽出した製造ラインの素材の要件と特徴をもとに、LLMアイデア生成を実施
 *
*/

import * as fs from "fs/promises";
import * as readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
import OpenAI from "openai";

import { PROMPT1, PROMPT2, PROMPT2_2, PROMPT3 } from "./prompts.js";

const client = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'], // This is the default and can be omitted
});

async function step1(product: string, material2: string) {
  // check if product json is already exists
  const productPath = `./json/${material2}/products2/${product}.json`;
  try {
    await fs.access(productPath);
    console.log("製品の動作の流れはすでに抽出されています。");
    const data = await fs.readFile(productPath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.log("製品の動作の流れを抽出します。");
    const inputText = `\`\`\`入力
  ${product}
\`\`\``;
    try {
      console.log("LLMにStep1を問い合わせ中...");
      const response = await client.responses.create({
        model: "gpt-5.4",
        instructions: PROMPT1,
        input: inputText,
      });
      const outputText = response.output_text.replace(/```json/, "").replace(/```/, "");
      await fs.mkdir(`./json/${material2}/products2`, { recursive: true });
      await fs.writeFile(productPath, outputText, "utf-8");
      return JSON.parse(outputText);
    } catch (error) {
      console.error("LLMの応答の処理中にエラーが発生しました:", error);
      return {};
    }
  }
}

async function step2_2(product: string, process: string, features: string[], material2: string, competitor: string, competitorMaterial: string) {
  // check if competitor json is already exists
  const competitorPath = `./json/${material2}/competitorMaterials2/${product}/${process}/${competitor}.json`;
  try {
    await fs.access(competitorPath);
    console.log("製品の動作の流れはすでに抽出されています。");
    const data = await fs.readFile(competitorPath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.log("製品の動作の流れを抽出します。");
    const inputText = `\`\`\`入力
  製品: ${product}
  動作の過程: ${process}
  動作の特徴: ${features.join(", ")}
  使用している素材: ${competitor}
  競合素材の特徴: ${competitorMaterial}
\`\`\``;
    try {
      console.log("LLMにStep2を問い合わせ中...");
      const response = await client.responses.create({
        model: "gpt-5.4",
        instructions: PROMPT2_2,
        input: inputText,
        tools: [
          { type: "web_search" },
        ],
      });
      const outputText = response.output_text.replace(/```json/, "").replace(/```/, "");
      await fs.mkdir(`./json/${material2}/competitorMaterials2/${product}/${process}`, { recursive: true });
      await fs.writeFile(competitorPath, outputText, "utf-8");
      return JSON.parse(outputText);
    } catch (error) {
      console.error("LLMの応答の処理中にエラーが発生しました:", error);
      return {};
    }
  }
}

async function step2(product: string, process: string, features: string[], material2: string) {
  // check if competitor json is already exists
  const competitorPath = `./json/${material2}/competitor2/${product}/${process}.json`;
  try {
    await fs.access(competitorPath);
    console.log("製品の動作の流れはすでに抽出されています。");
    const data = await fs.readFile(competitorPath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.log("製品の動作の流れを抽出します。");
    const inputText = `\`\`\`入力
  製品: ${product}
  動作の過程: ${process}
  動作の特徴: ${features.join(", ")}
\`\`\``;
    try {
      console.log("LLMにStep2を問い合わせ中...");
      const response = await client.responses.create({
        model: "gpt-5.4",
        instructions: PROMPT2,
        input: inputText,
      });
      const outputText = response.output_text.replace(/```json/, "").replace(/```/, "");
      await fs.mkdir(`./json/${material2}/competitor2/${product}`, { recursive: true });
      await fs.writeFile(competitorPath, outputText, "utf-8");
      return JSON.parse(outputText);
    } catch (error) {
      console.error("LLMの応答の処理中にエラーが発生しました:", error);
      return {};
    }
  }
}

async function step3(product: string, process: string, features: string[], requirements: string[], material: string, material2: string, competitor: string, material3: string, howUsed: string, score: number) {
  if (score < 70) return; // 既存製造レーンで使われているかどうかの点数が80点未満の場合は、アイデア生成をスキップ
  // ここで、製品の動作の流れ、特徴、素材の要件をもとに、LLMにアイデアを提案してもらう
  await fs.mkdir(`./json/${material2}/idea2/${product}/${process}/${material3}`, { recursive: true });
  const ideaPath = `./json/${material2}/idea2/${product}/${process}/${material3}/${competitor}.json`;
  try {
    await fs.access(ideaPath);
    console.log("LLMアイデアはすでに抽出されています。");
    const data = await fs.readFile(ideaPath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.log("LLMアイデアを抽出します。");
  }
  const inputText = `\`\`\`入力
  製品: ${product}
  動作: ${process}
  動作の特徴: ${features.join(", ")}
  素材の要件: ${requirements.join(", ")}
  使用される素材：${material3}
  使ってみたい素材: ${material2}
  競合素材の使われ方: ${competitor} : ${howUsed}
\`\`\``;
  try {
    console.log("LLMにStep3を問い合わせ中...");
    const response = await client.responses.create({
      model: "gpt-5.4",
      instructions: PROMPT3,
      input: inputText,
    });
    const outputText = response.output_text.replace(/```json/, "").replace(/```/, "");
    console.log("提案されたアイデア:", outputText);
    await fs.writeFile(ideaPath, outputText, "utf-8");
    return JSON.parse(outputText);
  } catch (error) {
    console.error("LLMの応答の処理中にエラーが発生しました:", error);
    return {};
  }
}

async function mainStep(
    product: string,
    material2: string,
    material: string,
    competitorMaterial: string
) {

  if (!product || !material2 || !material || !competitorMaterial) {
    console.error("製品名と素材名は必須です。");
    return;
  }

  const flow = await step1(product, material2);
  if (!flow.flow || !Array.isArray(flow.flow) || flow.flow.length === 0) {
    console.error("動作の流れの抽出に失敗しました。");
    return;
  }

  // for (const process of flow.flow) {
  flow.flow.forEach(async(process: any) => {
    const { process: processName, features } = process;
    console.log(`動作の過程: ${processName}`);
    if (!processName || !features || !Array.isArray(features)) {
      console.error("動作の過程や特徴の抽出に失敗しました。");
      return;
    }
    const competitors = await step2(product, processName.replace(/\//g, ""), features, material2);
    if (!Array.isArray(competitors) || competitors.length === 0) {
      console.error("素材の要件と特徴の抽出に失敗しました。");
      return;
    }
    for (const materials of competitors) {
      const { requirements, material: material4 } = materials;
      console.log(`素材の要件: ${requirements.join(", ")}`);
      if (!requirements || !Array.isArray(requirements) || requirements.length === 0) {
        console.error("素材の要件の抽出に失敗しました。");
        continue;
      }
      const competitorMaterials = await step2_2(product, processName.replace(/\//g, ""), features, material2, material4.replace(/\//g, ""), competitorMaterial);
      if (!Array.isArray(competitorMaterials) || competitorMaterials.length === 0) {
        console.error("競合素材の要件と特徴の抽出に失敗しました。");
        continue;
      }
      for (const competitorMaterialData of competitorMaterials) {
        const { howUsed, material: material3, score } = competitorMaterialData;
        await step3(product, processName.replace(/\//g, ""), features, requirements, material, material2, material3, material4.replace(/\//g, ""), howUsed, score);
      }
    }
  });
}

async function main() {
  let products: string[] = [];
  try {
    const productString = await fs.readFile("./json/products_kaden.json", "utf-8");
    products = JSON.parse(productString);
  } catch (error) {
    console.error("製品リストの読み込みに失敗しました:", error);
    return;
  }
  products = products.sort(() => Math.random() - 0.5).slice(0, 1); // 製品数は20個までに制限
  console.log("\n\n応用したい素材の名前を簡潔に入力してください。\n\n");
  // get user input
  const rl2 = readline.createInterface({ input, output });
  let material2: string = "";
  try {
    material2 = await rl2.question("素材名: ");
  } catch (error) {
    console.error("入力エラー:", error);
  } finally {
    rl2.close();
  }
  material2 = material2.slice(0, 20); // 素材名は20文字までに制限
  // get user input
  const rl4 = readline.createInterface({ input, output });
  console.log("\n\n応用したい素材の競合素材を入力してください\n\n");
  let competitorMaterial: string = "";
  try {
    competitorMaterial = await rl4.question("競合になる素材一覧(カンマ区切りで入力): ");
  } catch (error) {
    console.error("入力エラー:", error);
  } finally {
    rl4.close();
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
  const splittedProducts = products.reduce((a: string[][], b: string) => {
    const index = Math.floor(products.indexOf(b) / 10);
    if (!a[index] || !Array.isArray(a[index])) {
      a[index] = [];
    }
    a[index].push(b);
    return a;
  }, []);
  for (const splittedProduct of splittedProducts) {
    splittedProduct.forEach(async(product: string) => {
      await mainStep(product, material2, material, competitorMaterial);
    });
  }
}

main();