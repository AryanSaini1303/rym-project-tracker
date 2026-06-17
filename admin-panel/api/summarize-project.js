export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const openAiKey = process.env.OPENAI_API_KEY;

  if (!openAiKey) {
    return res.status(500).json({ error: 'Missing OPENAI_API_KEY in .env file' });
  }

  try {
    const parsedBody = req.body;
    let rawText = parsedBody.text || '';
    const link = parsedBody.link || '';

    if (link) {
      try {
        let fetchUrl = link;
        // If it's a Google Doc, try to grab the pure text export directly
        if (link.includes('docs.google.com/document/d/')) {
          const docIdMatch = link.match(/\/d\/([a-zA-Z0-9-_]+)/);
          if (docIdMatch) {
            fetchUrl = `https://docs.google.com/document/d/${docIdMatch[1]}/export?format=txt`;
          }
        }
        
        const linkRes = await fetch(fetchUrl);
        if (!linkRes.ok) throw new Error("Failed to fetch link");
        const htmlOrText = await linkRes.text();
        
        // Strip scripts, styles, and HTML tags to get raw text
        rawText = htmlOrText
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<[^>]*>?/gm, ' ')
          .replace(/\s\s+/g, ' ');
      } catch (err) {
        return res.status(400).json({ error: 'Failed to extract text from link. Please ensure it is public.' });
      }
    }

    // Truncate to save tokens (approx 4 pages of text max)
    const truncatedText = rawText.substring(0, 15000);

    const openaiReqBody = JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are an expert technical project manager. Read the following raw extracted text from a project brief/document. Create a highly accurate JSON object with exactly three keys: 'title' (a concise 3-6 word project title), 'description' (a highly detailed summary between 150-200 words capturing the full scope, requirements, and deliverables), and 'tasks' (an array of objects, where each object represents a main task/milestone/scope item extracted from headings or main sections in the text, containing: 'title' [a short, clear, action-oriented task title, 3-7 words] and 'description' [a brief task description]). The output MUST be valid JSON."
        },
        {
          role: "user",
          content: truncatedText
        }
      ]
    });

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiKey}`,
        'Content-Type': 'application/json'
      },
      body: openaiReqBody
    });

    const openaiData = await openaiRes.json();
    if (!openaiRes.ok) {
      return res.status(openaiRes.status).json(openaiData);
    }

    return res.status(200).json(openaiData);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid request body or processing error' });
  }
}
