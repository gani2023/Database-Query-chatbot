import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import OpenAI from "openai";
import supabase from "./supabase.js";
import fs from "fs";

// OpenAI API Setup
const openai = new OpenAI({
  apiKey: "your_openai_api_key", // Replace with your OpenAI API key
});

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(cors());


// Generate GPT Analysis/Insights from the query result
async function generateGPTAnalysis(userMessage, sqlQuery, queryResult) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        max_tokens: 200,
        messages: [
          {
            role: "system",
            content: `
              You are a data analyst who provides insights, recommendations, and explanations based on SQL query results.
              Analyze the query result and provide a clear, concise, and helpful summary or explanation.
              Offer relevant insights, trends, or suggestions based on the result.
              If the result contains numerical data, calculate averages, identify trends, or point out key observations.
              Keep the response short and insightful (within 3-4 sentences).
            `,
          },
          {
            role: "user",
            content: `
            User Request: ${userMessage}
            SQL Query: ${sqlQuery}
            Query Result: ${queryResult}
            `,
          },
        ],
      });
  
      const gptResponse = completion.choices[0].message.content.trim();
      return gptResponse || "💡 No additional insights available.";
    } catch (error) {
      console.error("❌ Error generating GPT analysis:", error);
      return "❌ Error while generating insights.";
    }
  }
  


// Generate SQL and query Supabase
async function generateAndQuerySQL(userMessage) {
    try {
      // Generate SQL from OpenAI
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        max_tokens: 200,
        messages: [
          {
            role: "system",
            content: `
              You are a PostgreSQL expert with deep knowledge of SQL.
              Generate SQL queries for a PostgreSQL database stored in Supabase.
              The database contains a single table named "data_set_sales" with the following columns and types:
              
              - "Row_ID" (int4) - Primary key
              - "Order_ID" (text)
              - "Order_Date" (date)
              - "Ship_Date" (date)
              - "Ship_Mode" (text)
              - "Customer_Name" (text)
              - "Segment" (text)
              - "Country" (text)
              - "City" (text)
              - "State" (text)
              - "Postal_Code" (varchar)
              - "Region" (text)
              - "Product_ID" (text)
              - "Category" (text)
              - "Sub-Category" (text)
              - "Product_Name" (text)
              - "Sales" (numeric)
              - "Quantity" (int4)
              - "Discount" (numeric)
              - "Profit" (numeric)
  
              Important Rules:
              1. Always use double quotes for table and column names.
              2. Never prefix column names with the table name when using double quotes.
              3. Do NOT include a semicolon (;) at the end of the query.
              4. Return only the SQL query. Do not add any explanations or comments.
            `,
          },
          { role: "user", content: userMessage },
        ],
      });
  
      let generatedSQL = completion.choices[0].message.content.trim();
  
      // ✅ Ensure no semicolon at the end
      if (generatedSQL.endsWith(";")) {
        generatedSQL = generatedSQL.slice(0, -1); // Remove the last character
      }
  
      console.log(`📚 Generated SQL: ${generatedSQL}`);
  
      // Run the query on Supabase and get the result
      const result = await runSupabaseQuery(generatedSQL);

      //result in plain text
      const formattedResult = formatResult(result);
  
      // Return both the SQL and result
      return {
        sqlQuery: generatedSQL,
        queryResult: formattedResult,
      };
    } catch (error) {
      console.error("❌ Error generating or running SQL:", error);
      return {
        sqlQuery: "",
        queryResult: "❌ Error while processing the request.",
      };
    }
  }

  // Format result for plain text output with ordered list if necessary
  function formatResult(data) {
    try {
      const parsedData = JSON.parse(data);
  
      // ✅ Check for single row and single column (e.g., single value like category or product name)
      if (parsedData.length === 1 && Object.keys(parsedData[0]).length === 1) {
        return `${Object.values(parsedData[0])[0]}`;
      }
  
      // ✅ Handle single column with multiple rows (convert to ordered list)
      if (parsedData.length > 1 && Object.keys(parsedData[0]).length === 1) {
        return parsedData
          .map((row, index) => `${index + 1}. ${Object.values(row)[0]}`)
          .join("\n");
      }
  
      // ✅ Handle multiple columns with multiple rows
      if (parsedData.length > 0) {
        const columns = Object.keys(parsedData[0]);
  
        // Check for date-related columns (like date, month, year)
        const dateColumns = columns.filter(
          (col) =>
            col.toLowerCase().includes("date") ||
            col.toLowerCase().includes("month") ||
            col.toLowerCase().includes("year")
        );
  
        // ✅ Format rows with multiple columns properly
        const rows = parsedData
          .map((row, index) => {
            const formattedRow = columns
              .map((col) => {
                const value = row[col];
  
                // 🕒 Handle Date Formatting
                if (dateColumns.includes(col)) {
                  if (typeof value === "string" && value.match(/^\d{4}-\d{2}$/)) {
                    // Already formatted (YYYY-MM)
                    return `${col}: ${value}`;
                  } else if (value && !isNaN(Date.parse(value))) {
                    // Format as YYYY-MM-DD if it's a valid date
                    const formattedDate = new Date(value).toISOString().split("T")[0];
                    return `${col}: ${formattedDate}`;
                  }
                }
  
                // 💡 Handle NULL or Undefined Values Gracefully
                if (value === null || value === undefined) {
                  return `${col}: N/A`;
                }
  
                // 🔢 Handle Numeric Formatting for Sales, Profits, etc.
                if (typeof value === "number" && col.toLowerCase().includes("sales")) {
                  return `${col}: $${value.toFixed(2)}`; // Format with 2 decimal places
                }
  
                // Default case
                return `${col}: ${value}`;
              })
              .join(", ");
  
            return `${index + 1}. ${formattedRow}`;
          })
          .join("\n");
  
        return rows;
      }
  
      return "✅ Query executed, but no results found.";
    } catch (error) {
      console.error("❌ Error formatting result:", error);
      return "❌ Error while formatting result.";
    }
  }
  
  
  
  
  
  
  
  
  // Helper function to validate if the response looks like SQL
  function isValidSQL(query) {
    // Check if the query contains a valid SQL pattern anywhere in the response
    return /SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER/i.test(query);
  }  

  function extractSQL(query) {
    // Match any SQL block or valid SQL statement
    const match = query.match(/(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)[\s\S]*;/i);
    return match ? match[0].trim() : null;
  }
  
  
// Run SQL query and return results from Supabase
async function runSupabaseQuery(query) {
    try {
      console.log(`📤 Sending SQL query to Supabase: ${query}`);
  
      // Run query using Supabase RPC
      const { data, error } = await supabase.rpc("run_sql_query", { query });
  
      if (error) {
        console.error("❌ Supabase SQL Error:", error);
        return `❌ SQL Error: ${error.message}`;
      }
  
      console.log(`📥 Received data from Supabase:`, data);
  
      // If no data, return message
      if (!data || data.length === 0) {
        return "✅ Query executed, but no results found.";
      }
  
      return JSON.stringify(data, null, 2);
    } catch (error) {
      console.error("❌ Error querying Supabase:", error);
      return "❌ Error while querying Supabase.";
    }
  }
  
  
  
  
  
  

// Save Chat Logs Locally
async function saveChatLog(userMessage, botResponse) {
  const chatLog = {
    userMessage,
    botResponse,
    timestamp: new Date().toISOString(),
  };

  fs.appendFile(
    "./logs/chatlogs.json",
    JSON.stringify(chatLog, null, 2) + ",\n",
    (err) => {
      if (err) console.error("Error saving chat log:", err);
    }
  );
}

// Handle User Requests
app.post("/", async (req, res) => {
    const { message } = req.body;
  
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }
  
    try {
      // Generate SQL and query Supabase
      const { sqlQuery, queryResult } = await generateAndQuerySQL(message);
  
      // Get GPT Analysis/Insights based on the result
      const gptResponse = await generateGPTAnalysis(message, sqlQuery, queryResult);
  
      // Return SQL query, result, and GPT analysis
      res.json({
        completion: {
          content: `
      ✅ SQL Query:
      ${sqlQuery}
      
      📊 Result:
      ${queryResult}
      
      💡 GPT Insights:
      ${gptResponse}
          `.trim(),
        },
      });
      
    } catch (error) {
      console.error("❌ Error handling request:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });  
  
  

// Start Server
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
