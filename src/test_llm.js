import "./env.js";

async function main() {
  const { llmFast, llmDeep } = await import("./llm.js");

  console.log("FAST_MODEL:", process.env.FAST_MODEL || "not set (will use llm default)");
  console.log(
    "OPENAI_API_KEY:",
    process.env.OPENAI_API_KEY ? `${process.env.OPENAI_API_KEY.slice(0, 6)}...` : "MISSING"
  );

  try {
    console.log("\nFAST MODEL TEST:");
    const outFast = await llmFast(
      "Summarize in one sentence: The quick brown fox jumps over the lazy dog.",
      { temperature: 0.2, max_tokens: 60 }
    );
    console.log("FAST result:", outFast);
  } catch (err) {
    console.error("FAST error:", err?.message ?? err);
  }

  try {
    console.log("\nDEEP MODEL TEST:");
    const outDeep = await llmDeep("Translate to French: Hello world", {
      temperature: 0.2,
      max_tokens: 60,
    });
    console.log("DEEP result:", outDeep);
  } catch (err) {
    console.error("DEEP error:", err?.message ?? err);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
