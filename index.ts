import { file } from 'bun';
import { runInNewContext } from 'node:vm';
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: process.env.OPENROUTER_URL,
  apiKey: process.env.OPENROUTER_KEY,
  defaultHeaders: {
    "HTTP-Referer": process.env.SITE_URL,
    "X-Title": process.env.SITE_NAME,
  }
})

// RLM-ENGINE
class RLMEngine {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  /**
    * OPTIMIZATION 2: Structured Output
    * The Leaf agent returns JSON. This allows us to programmatically
    * discard "I don't know" answers without reading them.
    */

  private async askLeafAgent(chunk: string, query: string): Promise<{ found: boolean; answer: string }> {

    try {

      const response = await client.chat.completions.create({
        model: process.env.LEAF_MODEL ?? "openai/gpt-4o-mini",
        response_format: { type: "json_object" }, // Force JSON
        messages: [
          {
            role: "system",
            content: `You are a precise data extractor.
             Analyze the text chunk. Does it contain information relevant to the user's query?
             Return JSON: { "found": boolean, "answer": "extracted info or reasoning" }
             If not found, set "found": false.`
          },
          { role: "user", content: `Query: ${query}\n\nText Chunk: ${chunk}` },
        ],
      });

      const content = response.choices[0]?.message?.content || "{}";
      return JSON.parse(content);
    } catch (error) {
      return { found: false, answer: "Error processing chunk" };
    }
  }

  public async run(userQuery: string) {
    console.log(`\n🧠 Smart RLM Processing: "${userQuery}"`);
    console.log(`📚 Context Size: ${this.context.length} chars`);

    // OPTIMIZATION 3: The "Smart" System Prompt
    // We teach the agent to use keywords to save money.
    const systemPrompt = `
    You are a **Senior JavaScript RLM (Recursive Language Model) Architect**.
    Your goal is to answer the User Query by writing a JavaScript script that analyzes a massive text variable named \`CONTEXT\`.

    **⚠️ CRITICAL CONSTRAINTS:**
    1. **Efficiency First:** You are billed per token. DO NOT process the whole text if keywords can narrow it down.
    2. **Safety Net:** If keyword filtering results in 0 chunks, you MUST fallback to reading the entire text (or a larger subset) to ensure the answer isn't missed.
    3. **Output:** Return **ONLY** raw JavaScript code. No Markdown (\`\`\`). No explanations.

    **🛠️ YOUR TOOLBOX (Available in the Sandbox):**
    - \`CONTEXT\` (string): The massive text document.
    - \`chunk_text(text, size, overlap)\`: Returns \`string[]\`.
        - Recommended: \`size=15000\`, \`overlap=500\`.
    - \`keyword_filter(chunks, keywords)\`: Returns \`string[]\`.
        - Filters chunks containing ANY of the keywords (case-insensitive).
    - \`ask_leaf(chunk, query)\`: Returns \`Promise<{ found: boolean, answer: string }>\`.
        - Uses a cheaper LLM to analyze a specific chunk.
    - \`print(text)\`: Prints the final answer to the console.

    **🧠 THE ALGORITHM YOU MUST WRITE:**
    1. **Chunking:** Split \`CONTEXT\` into chunks with overlap.
    2. **Keyword Strategy:**
       - Identify 2-3 **broad** keywords from the user query (e.g., for "invoice #99", use "invoice", NOT "invoice #99").
       - Run \`keyword_filter\`.
    3. **Branching Logic (The Safety Net):**
       - **IF** filtered chunks exist: Process only those chunks.
       - **ELSE** (0 chunks found): Process **ALL** chunks (fallback mode).
    4. **Parallel Execution:**
       - Use \`await Promise.all(chunks.map(...))\` to call \`ask_leaf\` concurrently.
    5. **Aggregation:**
       - Filter the results to keep only objects where \`found === true\`.
       - If multiple answers are found, combine them and call \`ask_leaf\` again to get the final perfect answer based on the context.
       - If no answers are found after all attempts, report "Information not found in context."
    6. **Final Output:** Call \`print()\` with the synthesized answer.

    **Example Logic Structure:**
    \`\`\`javascript
    const chunks = chunk_text(CONTEXT, 15000, 500);
    const keywords = ["keyword1", "keyword2"];
    let targets = keyword_filter(chunks, keywords);

    if (targets.length === 0) {
      print("⚠️ Warning: Keywords not found. Scanning full document...");
      targets = chunks; // Fallback to full scan
    }

    const results = await Promise.all(targets.map(c => ask_leaf(c, USER_QUERY)));
    const valid = results.filter(r => r.found);

    if (valid.length > 0) {
      // Combine answers and call ask_leaf() again
      print(valid.map(v => v.answer).join("\\n"));
    } else {
      print("Answer not found.");
    }
    \`\`\`
        `;

    const completion = await client.chat.completions.create({
      model: process.env.ROOT_MODEL ?? "openai/gpt-5-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userQuery },
      ],
    });

    let code = completion.choices[0]?.message?.content || "";
    code = code.replace(/```javascript/g, "").replace(/```/g, "").trim();
    console.log("\n📜 Strategy Code:\n", "---------------------------------------------------");
    console.log(code);
    console.log("---------------------------------------------------\n");
    await this.executeSandbox(code, userQuery);
  }

  private async executeSandbox(code: string, originalQuery: string) {
    const sandbox = {
      CONTEXT: this.context,
      console: console,

      // Tool: Smart Chunking with Overlap
      chunk_text: (text: string, size: number = 10000, overlap: number = 500) => {
        const chunks = [];
        for (let i = 0; i < text.length; i += (size - overlap)) {
          chunks.push(text.substring(i, i + size));
        }
        return chunks;
      },

      // Tool: Cheap Keyword Filtering (The Cost Saver)
      keyword_filter: (chunks: string[], keywords: string[]) => {
        console.log(`🔍 Filtering ${chunks.length} chunks for keywords: [${keywords}]`);
        const filtered = chunks.filter(chunk =>
          keywords.some(k => chunk.toLowerCase().includes(k.toLowerCase()))
        );
        console.log(`📉 Reduced to ${filtered.length} relevant chunks.`);
        return filtered;
      },

      // Tool: The LLM Call
      ask_leaf: (chunk: string, query: string) => this.askLeafAgent(chunk, query || originalQuery),
      print: (text: string) => console.log("\n✅ FINAL ANSWER:\n", text),
    };

    const wrappedCode = `(async () => { try { ${code} } catch (e) { console.error(e); } })();`;
    await runInNewContext(wrappedCode, sandbox);
  }
}


// Demo
const context = file('data.txt');
const rlm = new RLMEngine(await context.text());
await rlm.run(`How can I connect and read files from S3 using Bun. Provide a working example code.`)
