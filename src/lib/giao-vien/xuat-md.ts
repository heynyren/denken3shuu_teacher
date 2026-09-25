/**
 * BẢN GIÁO VIÊN — xuất một đề trộn ra Markdown để dán ra ngoài đi biên soạn.
 *
 * Mỗi câu đủ thông tin để tìm lại đề gốc: tên Nhật/Việt, kỳ thi + số câu gốc,
 * độ khó, dạng bài, link denken-ou và link PDF chính thức (nếu trung tâm còn
 * giữ — link chết thì vẫn còn đường denken-ou, xem ghi chú trong lib/de-thi.ts).
 */

import { itemById, subjectName, subjectViName } from "../catalog";
import { linkDeThi } from "../de-thi";
import { LOAI_TEN, loaiCau } from "./loai-cau";
import type { DeTao } from "./types";

export function deTaoMarkdown(de: DeTao): string {
  const dong: string[] = [];
  dong.push(`# Đề trộn ${de.thang || de.createdAt.slice(0, 10)} — ${subjectName(de.subject)} ${subjectViName(de.subject)}`);
  dong.push("");
  if (de.scope) {
    dong.push(`Giới hạn theo phần đã dạy: ${de.scope.categories.join(", ")}`);
    dong.push("");
  }
  if (de.note) {
    dong.push(de.note);
    dong.push("");
  }

  for (const slot of de.slots) {
    const item = itemById.get(slot.itemId);
    if (!item) {
      dong.push(`## 問${slot.no} — (bài ${slot.itemId} không còn trong danh mục)`);
      dong.push("");
      continue;
    }
    const pdf = linkDeThi(item.exam, item.subject);
    dong.push(`## 問${slot.no} — ${item.name}`);
    if (item.nameVi) dong.push(`${item.nameVi}`);
    dong.push(
      `- Gốc: ${item.exam} ${item.question} · ${item.category} · ${"★".repeat(item.stars)} · ${LOAI_TEN[loaiCau(item)]}`,
    );
    dong.push(`- Bài + lời giải: ${item.url}`);
    if (pdf) dong.push(`- Đề gốc (PDF): ${pdf}`);
    dong.push("");
  }
  return dong.join("\n");
}
