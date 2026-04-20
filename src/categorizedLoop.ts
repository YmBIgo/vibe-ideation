import * as fs from "fs/promises";
import * as readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
import OpenAI from "openai";

import { PROMPT1, PROMPT2, PROMPT3, PROMPT3_3, REMOVE_DUPLICATE_CATEGORY_PROMPT } from "./prompts.js";

const client = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'], // This is the default and can be omitted
});

async function step0(material2: string) {
  const categoriesPath = `./json/${material2}/categories.json`;
  try {
    await fs.access(categoriesPath);
    const data = await fs.readFile(categoriesPath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.log("カテゴリのファイルが存在しません。");
    return [];
  }
}

async function step1(product: string, material2: string) {
  // check if product json is already exists
  const productPath = `./json/${material2}/products/${product}.json`;
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
      await fs.mkdir(`./json/${material2}/products`, { recursive: true });
      await fs.writeFile(productPath, outputText, "utf-8");
      return JSON.parse(outputText);
    } catch (error) {
      console.error("LLMの応答の処理中にエラーが発生しました:", error);
      return {};
    }
  }
}

async function step2(product: string, process: string, features: string[], material2: string) {
  // check if competitor json is already exists
  const competitorPath = `./json/${material2}/competitor/${product}/${process}.json`;
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
      await fs.mkdir(`./json/${material2}/competitor/${product}`, { recursive: true });
      await fs.writeFile(competitorPath, outputText, "utf-8");
      return JSON.parse(outputText);
    } catch (error) {
      console.error("LLMの応答の処理中にエラーが発生しました:", error);
      return {};
    }
  }
}

async function step3(
  product: string,
  process: string,
  features: string[],
  requirements: string[],
  material: string,
  competitor: string,
  material2: string,
  categories: string[]
) {
  // ここで、製品の動作の流れ、特徴、素材の要件をもとに、LLMにアイデアを提案してもらう
  const oldIdeaPath = `./json/${material2}/idea/${product}/${process}/${competitor}.json`;
  const ideaPath = `./json/${material2}/categorizedIdea/${product}/${process}/${competitor}/placeUsed.json`;
  try {
    await fs.access(ideaPath);
    console.log("LLMアイデアはすでに抽出されています。");
    return [];
  } catch (error) {
    console.log("LLMアイデアを抽出します。");
  }
  try {
    await fs.access(oldIdeaPath);
    const dataString = await fs.readFile(oldIdeaPath, "utf-8");
    const data = JSON.parse(dataString);
    if (data && !Array.isArray(data)) {
      console.error("既存のアイデアファイルの形式が不正です。配列形式である必要があります。");
      return;
    }
    const isScoreAbove88 = data.some((idea: any) => idea.score >= 88);
    if (!isScoreAbove88) {
      console.log("既存のアイデアファイルにはスコア88以上のアイデアが含まれていません。");
      return;
    }
  } catch (error) {
    console.log("LLMアイデアは存在しません...");
    return;
  }

  await fs.mkdir(`./json/${material2}/categorizedIdea/${product}/${process}`, { recursive: true });
  await fs.mkdir(`./json/${material2}/categorizedIdea/${product}/${process}/${competitor}`, { recursive: true });

  let placeUsed: Record<string, number> = {};

  async function generateIdea(
    product: string,
    process: string,
    features: string[],
    requirements: string[],
    material: string,
    category: string,
    ideaPath2: string
  ) {
    const inputText = `\`\`\`入力
製品: ${product}
動作: ${process}
動作の特徴: ${features.join(", ")}
素材の要件: ${requirements.join(", ")}
使ってみたい素材: ${material}
使ってみたい素材の使い道： ${category}
今までに出てきた素材を使う場所： ${placeUsed ? Object.keys(placeUsed).join(", ") : "なし"}
\`\`\``;
    try {
      console.log("LLMにStep3を問い合わせ中...");
      const response = await client.responses.create({
        model: "gpt-5.4",
        instructions: PROMPT3_3,
        input: inputText,
      });
      const outputText = response.output_text.replace(/```json/, "").replace(/```/, "");
      // console.log("提案されたアイデア:", outputText);
      await fs.writeFile(ideaPath2, outputText, "utf-8");
      const ideaJson = JSON.parse(outputText);
      ideaJson.placeUsed.forEach((place: string) => {
        if (placeUsed[place]) {
          placeUsed[place] += 1;
        } else {
          placeUsed[place] = 1;
        }
      });
    } catch (error) {
      console.error("LLMの応答の処理中にエラーが発生しました:", error);
      return;
    }
  }

  const firstCategory = categories[0];
  const remainCategories = categories.slice(1);
  const firstIdeaPath = `./json/${material2}/categorizedIdea/${product}/${process}/${competitor}/${firstCategory}.json`;

  if (firstCategory) {
    await generateIdea(product, process, features, requirements, material, firstCategory, firstIdeaPath);
  }

  const slicedRemainCategories = [];
  for (let i = 0; i < remainCategories.length; i += 10) {
    slicedRemainCategories.push(remainCategories.slice(i, i + 10));
  }

  for(const category of slicedRemainCategories) {
    await Promise.all(category.map(async (cat) => {
      const ideaPath2 = `./json/${material2}/categorizedIdea/${product}/${process}/${competitor}/${cat}.json`;
      try {
        await fs.access(ideaPath2);
        console.log("LLMアイデアはすでに抽出されています。");
        // const data = await fs.readFile(ideaPath2, "utf-8");
        try {
          if (Object.keys(placeUsed).length === 0) {
            const filePaths = await fs.readdir(`./json/${material2}/categorizedIdea/${product}/${process}/${competitor}`);
            for (const filePath of filePaths) {
              const dataString = await fs.readFile(`./json/${material2}/categorizedIdea/${product}/${process}/${competitor}/${filePath}`, "utf-8");
              const data = JSON.parse(dataString);
              if (data && data.placeUsed) {
                data.placeUsed.forEach((place: string) => {
                  if (placeUsed[place]) {
                    placeUsed[place] += 1;
                  } else {
                    placeUsed[place] = 1;
                  }
                });
              }
            }
          }
          await fs.writeFile(ideaPath, JSON.stringify(placeUsed, null, 2), "utf-8");
        } catch (error) {
          console.error("使用箇所の抽出中にエラーが発生しました:", error);
        }
        return;
      } catch (error) {
        console.log("LLMアイデアを抽出します。", cat);
      }
      await generateIdea(product, process, features, requirements, material, cat, ideaPath2);
    }));
//     try {
//       const inputText = `\`\`\`入力
// 今までに出てきた素材を使う場所： ${placeUsed ? Object.keys(placeUsed).join(", ") : "なし"}
// \`\`\``;
//       console.log("LLMにStep_remove_duplicateを問い合わせ中...");
//       const response = await client.responses.create({
//         model: "gpt-5.4",
//         instructions: REMOVE_DUPLICATE_CATEGORY_PROMPT,
//         input: inputText,
//       });
//       const outputText = response.output_text.replace(/```json/, "").replace(/```/, "");
//       const ideaJson = JSON.parse(outputText);
//       placeUsed = ideaJson; // できれば結合したい...
//     } catch (error) {
//       console.error("LLMの応答の処理中にエラーが発生しました:", error);
//       continue;
//     }
  };
  try {
    const filePaths = await fs.readdir(`./json/${material2}/categorizedIdea/${product}/${process}/${competitor}`);
    for (const filePath of filePaths) {
      const dataString = await fs.readFile(`./json/${material2}/categorizedIdea/${product}/${process}/${competitor}/${filePath}`, "utf-8");
      const data = JSON.parse(dataString);
      if (data && data.placeUsed) {
        data.placeUsed.forEach((place: string) => {
          if (placeUsed[place]) {
            placeUsed[place] += 1;
          } else {
            placeUsed[place] = 1;
          }
        });
      }
    }
    await fs.writeFile(ideaPath, JSON.stringify(placeUsed, null, 2), "utf-8");
  } catch (error) {
    console.error("使用箇所の抽出中にエラーが発生しました:", error);
  }
}

async function mainStep(product: string, material2: string, material: string) {

  if (!product || !material2 || !material) {
    console.error("製品名と素材名は必須です。");
    return;
  }

  const flow = await step1(product, material2);
  if (!flow.flow || !Array.isArray(flow.flow) || flow.flow.length === 0) {
    console.error("動作の流れの抽出に失敗しました。");
    return;
  }

  const categories = await step0(material2);
  if (!Array.isArray(categories)) {
    console.error("カテゴリの読み込みに失敗しました。");
    return;
  }

  for (const process of flow.flow) {
//   flow.flow.forEach(async(process: any) => {
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
    for (const competitor of competitors) {
      const { requirements, material: competitor1 } = competitor;
      console.log(`素材の要件: ${requirements.join(", ")}`);
      if (!requirements || !Array.isArray(requirements) || requirements.length === 0) {
        console.error("素材の要件の抽出に失敗しました。");
        continue;
      }
      await step3(product, processName.replace(/\//g, ""), features, requirements, material, competitor1.replace(/\//g, ""), material2, categories);
    }
//   });
  }
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
  }, [])
  .slice(1, 2); // debugのため、最初の10製品のみに制限
  for (const splittedProduct of [["スマートスピーカー"]]) {
    // debugのため、最初の2製品のみに制限
    splittedProduct.slice(0, 1).forEach(async(product: string) => {
      await mainStep(product, material2, material);
    });
  }
}

main();