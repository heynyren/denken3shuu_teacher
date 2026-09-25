/**
 * BẢN GIÁO VIÊN — phân loại DẠNG BÀI từ tên tiếng Nhật.
 *
 * Danh mục không có trường "dạng bài" riêng: dạng nằm ở ĐUÔI tên bài trên
 * denken-ou.com — `…に関する計算問題`, `…空欄穴埋問題`, `…論説問題`. Soát cả
 * 1675 bài thì 772 tính toán, 488 điền khuyết, 380 luận; còn ~35 bài mang đuôi
 * hiếm (選択問題, 正誤問題…) gom vào "khác". Vài bài có phần dịch tiếng Việt
 * kẹp trong ngoặc ở cuối tên — phải bỏ ngoặc trước rồi mới dò đuôi.
 */

import type { CatalogItem } from "../types";

export type LoaiCau = "calc" | "blank" | "essay" | "other";

/** Thứ tự có chủ ý: đuôi dài dò trước, "空欄穴埋・計算問題" tính là điền khuyết. */
const DUOI: Array<[string, LoaiCau]> = [
  ["空欄穴埋・計算問題", "blank"],
  ["空欄穴埋問題", "blank"],
  ["計算問題", "calc"],
  ["論説問題", "essay"],
];

export function loaiCau(item: CatalogItem): LoaiCau {
  const core = item.name.replace(/\s*[(（][^)）]*[)）]\s*$/, "").trim();
  for (const [duoi, loai] of DUOI) if (core.endsWith(duoi)) return loai;
  return "other";
}

export const LOAI_TEN: Record<LoaiCau, string> = {
  calc: "Tính toán",
  blank: "Điền khuyết",
  essay: "Luận",
  other: "Khác",
};

/** Nhãn tiếng Nhật gốc, hiện kèm cho giáo viên quen mắt với đề thật. */
export const LOAI_TEN_JA: Record<LoaiCau, string> = {
  calc: "計算",
  blank: "穴埋",
  essay: "論説",
  other: "他",
};

export const LOAI_DS: LoaiCau[] = ["calc", "blank", "essay", "other"];
