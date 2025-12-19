import test from "node:test";
import assert from "node:assert/strict";
import { promptToPiMessage } from "../../src/acp/translate/prompt.js";

test("promptToPiMessage: concatenates text and resource links", () => {
  const { message, attachments } = promptToPiMessage([
    { type: "text", text: "Hello" },
    { type: "resource_link", uri: "file:///tmp/foo.txt", name: "foo" },
    { type: "text", text: " world" },
  ]);

  assert.equal(message, "Hello\n[Context] file:///tmp/foo.txt world");
  assert.deepEqual(attachments, []);
});

test("promptToPiMessage: includes embedded resource text as marker", () => {
  const { message, attachments } = promptToPiMessage([
    {
      type: "resource",
      resource: {
        uri: "file:///tmp/a.txt",
        mimeType: "text/plain",
        text: "hi",
      },
    },
  ] as any);

  assert.equal(message, "\n[Embedded Context] file:///tmp/a.txt (text/plain)\nhi");
  assert.deepEqual(attachments, []);
});

test("promptToPiMessage: includes embedded resource blob as marker", () => {
  const blob = Buffer.from("xyz", "utf8").toString("base64");

  const { message, attachments } = promptToPiMessage([
    {
      type: "resource",
      resource: {
        uri: "file:///tmp/a.bin",
        mimeType: "application/octet-stream",
        blob,
      },
    },
  ] as any);

  assert.equal(
    message,
    "\n[Embedded Context] file:///tmp/a.bin (application/octet-stream, 3 bytes)",
  );
  assert.deepEqual(attachments, []);
});

test("promptToPiMessage: includes audio as marker", () => {
  const data = Buffer.from("abc", "utf8").toString("base64");

  const { message, attachments } = promptToPiMessage([
    { type: "audio", mimeType: "audio/wav", data },
  ] as any);

  assert.equal(message, "\n[Audio] (audio/wav, 3 bytes) not supported by pi-acp");
  assert.deepEqual(attachments, []);
});

test("promptToPiMessage: maps image to attachment", () => {
  const base64 = Buffer.from("abc", "utf8").toString("base64");

  const { message, attachments } = promptToPiMessage([
    { type: "text", text: "see" },
    { type: "image", mimeType: "image/png", data: base64, uri: "img-1" },
  ]);

  assert.equal(message, "see");
  assert.equal(attachments.length, 1);
  assert.equal(attachments[0]!.id, "img-1");
  assert.equal(attachments[0]!.type, "image");
  assert.equal(attachments[0]!.mimeType, "image/png");
  assert.equal(attachments[0]!.fileName, "attachment.png");
  assert.equal(attachments[0]!.content, base64);
  assert.equal(attachments[0]!.size, 3);
});
