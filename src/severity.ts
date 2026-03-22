import fs from "fs/promises";
import OpenAI from "openai";
import { SEVERITY_PROMPT } from "./prompts.js";

const client = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'], // This is the default and can be omitted
});

async function main(material: string, score: number) {
  let foldersAndFiles: string[] = [];
  try {
    foldersAndFiles = await fs.readdir(`./json/${material}/idea/`);
  } catch (error) {
    console.error("Error reading directory:", error);
    return;
  }
  let files: string[] = [];
  for (const folder1 of foldersAndFiles) {
    let folderAndFiles: string[] = [];
    try {
      folderAndFiles = await fs.readdir(`./json/${material}/idea/${folder1}`);
    } catch (error) {
      console.error(`Error reading directory for folder ${folder1}:`, error);
      continue;
    }
    for (const folder2 of folderAndFiles) {
      try {
        folderAndFiles = await fs.readdir(`./json/${material}/idea/${folder1}/${folder2}`);
      } catch (error) {
        console.error(`Error reading directory for folder ${folder1}/${folder2}:`, error);
        continue;
      }
      for (const file of folderAndFiles) {
        if (!file.endsWith(".json")) {
          continue;
        }
        files.push(`./json/${material}/idea/${folder1}/${folder2}/${file}`);
      }
    }
  }
  let ideas: any[] = [];
  for (const file of files) {
    try {
      const content = await fs.readFile(file, "utf-8");
      const json = JSON.parse(content);
      if (!json || !Array.isArray(json) || json.length === 0) {
        continue;
      }
      ideas = [...ideas, ...json.filter((idea: any) => idea.score === score)];
    } catch (error) {
      console.error(`Error processing file ${file}:`, error);
      continue;
    }
  }
  ideas = Array.from(new Set(ideas));
  let slicedIdeas: any[][] = [];
  for (let i = 0; i < ideas.length; i += 10) {
    slicedIdeas.push(ideas.slice(i, i + 10));
  }
  let severityAddedIdeas: any[] = [];
  await Promise.all(slicedIdeas.map(async(idea, index) => {
    try {
      console.log(`Processing batch ${index + 1}/${slicedIdeas.length} with ${idea.length} ideas...`);
      const response = await client.responses.create({
        model: "gpt-5.2",
        instructions: SEVERITY_PROMPT,
        input: JSON.stringify(idea.map((idea: any) => ({
          idea: idea.idea,
          disadvantages: idea.disadvantages,
        }))),
      });
      const outputText = response.output_text.replace(/```json/, "").replace(/```/, "");
      const severityInfo = JSON.parse(outputText);
      severityAddedIdeas = [...severityAddedIdeas, ...idea.map((idea: any, i) => {
        const severity = severityInfo[i] || 9; // もしLLMからの応答に対応するseverityがない場合は、デフォルトで5（重大な懸念）を設定
        return { ...idea, severity };
      })];
    } catch (error) {
      console.error("LLMの応答の処理中にエラーが発生しました:", error);
      return;
    }
  }));
  severityAddedIdeas = severityAddedIdeas.sort((a, b) => a.severity - b.severity);
  try {
    await fs.writeFile(`./json/${material}/severity_ideas_${score}.json`, JSON.stringify(severityAddedIdeas, null, 2), "utf-8"); 
  } catch (error) {
    console.error("Error writing severity ideas to file:", error);
    console.log("Severity added ideas:", severityAddedIdeas);
  }
}

async function sortBySeverity(material: string, score: number) {
  const path = `./json/${material}/severity_ideas_${score}.json`;
  try {
    const content = await fs.readFile(path, "utf-8");
    const ideas = JSON.parse(content);
    const sortedIdeas = ideas.sort((a: any, b: any) => a.severity - b.severity);
    await fs.writeFile(`./json/${material}/sorted_severity_ideas_${score}.json`, JSON.stringify(sortedIdeas, null, 2), "utf-8");
  } catch (error) {
    console.error("Error sorting ideas by severity:", error);
  }
}

main("粉末積層箔", 90);
// sortBySeverity("粉末積層箔", 89);
