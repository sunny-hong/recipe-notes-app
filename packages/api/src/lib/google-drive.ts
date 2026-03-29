import PDFDocument from "pdfkit";

type TiptapNode = {
  type: string;
  text?: string;
  content?: TiptapNode[];
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};

function extractText(nodes: TiptapNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === "text") return node.text ?? "";
      if (node.content) return extractText(node.content);
      return "";
    })
    .join("");
}

export async function generateRecipePdf(
  title: string,
  content: TiptapNode,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Title
    doc.fontSize(24).font("Helvetica-Bold").text(title, { align: "left" });
    doc.moveDown(0.5);
    doc
      .moveTo(50, doc.y)
      .lineTo(doc.page.width - 50, doc.y)
      .strokeColor("#F5C842")
      .lineWidth(2)
      .stroke();
    doc.moveDown(0.5);

    // Body
    const nodes = content?.content ?? [];
    for (const node of nodes) {
      if (node.type === "heading") {
        const level = (node.attrs?.level as number) ?? 2;
        const fontSize = level === 1 ? 18 : level === 2 ? 15 : 13;
        doc
          .fontSize(fontSize)
          .font("Helvetica-Bold")
          .text(extractText(node.content ?? []), { lineGap: 4 });
        doc.moveDown(0.3);
      } else if (node.type === "paragraph") {
        const text = extractText(node.content ?? []);
        if (text) {
          doc
            .fontSize(11)
            .font("Helvetica")
            .text(text, { lineGap: 4, align: "left" });
          doc.moveDown(0.3);
        } else {
          doc.moveDown(0.5);
        }
      } else if (node.type === "bulletList" || node.type === "orderedList") {
        const items = node.content ?? [];
        items.forEach((item, i) => {
          const text = extractText(item.content ?? []);
          const bullet = node.type === "orderedList" ? `${i + 1}.` : "•";
          doc
            .fontSize(11)
            .font("Helvetica")
            .text(`${bullet}  ${text}`, { indent: 20, lineGap: 4 });
        });
        doc.moveDown(0.3);
      } else if (node.type === "blockquote") {
        const text = extractText(node.content ?? []);
        doc
          .fontSize(11)
          .font("Helvetica-Oblique")
          .text(text, { indent: 20, lineGap: 4 });
        doc.moveDown(0.3);
      }
    }

    doc.end();
  });
}

export async function uploadToDrive(
  accessToken: string,
  refreshToken: string,
  title: string,
  pdfBuffer: Buffer,
  existingFileId?: string | null,
): Promise<string> {
  const token = await getValidAccessToken(accessToken, refreshToken);

  const metadata = {
    name: `${title}.pdf`,
    mimeType: "application/pdf",
  };

  const boundary = "recipe_notes_boundary";
  const metadataStr = JSON.stringify(metadata);

  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    metadataStr,
    `--${boundary}`,
    "Content-Type: application/pdf",
    "",
  ].join("\r\n");

  const bodyEnd = `\r\n--${boundary}--`;
  const bodyBuffer = Buffer.concat([
    Buffer.from(body, "utf-8"),
    pdfBuffer,
    Buffer.from(bodyEnd, "utf-8"),
  ]);

  const url = existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
    : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";

  const method = existingFileId ? "PATCH" : "POST";

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
      "Content-Length": bodyBuffer.length.toString(),
    },
    body: bodyBuffer,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Drive API error: ${err}`);
  }

  const data = (await response.json()) as { id: string };
  return data.id;
}

async function getValidAccessToken(
  accessToken: string,
  refreshToken: string,
): Promise<string> {
  // Try the current access token first with a quick validation
  const testRes = await fetch(
    "https://www.googleapis.com/oauth2/v1/tokeninfo",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (testRes.ok) return accessToken;

  // Refresh if expired
  const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!refreshRes.ok) throw new Error("Failed to refresh Google token");
  const refreshData = (await refreshRes.json()) as { access_token: string };
  return refreshData.access_token;
}
