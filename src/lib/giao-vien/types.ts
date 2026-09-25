/**
 * BẢN GIÁO VIÊN — kiểu dữ liệu riêng của người dạy.
 *
 * Mọi thứ giáo-viên-riêng gom về thư mục `giao-vien/` để sau này kéo thay đổi
 * từ repo học sinh về chỉ đụng vài mối nối nhỏ trong file dùng chung.
 */

import type { SubjectKey } from "../types";

/** Một vị trí câu trong đề đã trộn. */
export interface DeTaoSlot {
  /** Số câu trong đề trộn: 1..N theo cấu trúc đề thật của môn. */
  no: number;
  /** id bài trong danh mục (`CatalogItem.id`) — tra ra tên, link, sao, kỳ gốc. */
  itemId: string;
}

/** Một đề thi thử đã trộn và lưu lại. */
export interface DeTao {
  id: string;
  createdAt: string;
  subject: SubjectKey;
  /** Nhãn tháng tự đặt, ví dụ "Tháng 10/2026". Chỉ để nhận ra đề. */
  thang: string;
  /**
   * Có mặt khi đề trộn theo chế độ GIỚI HẠN PHẠM VI: chỉ lấy bài thuộc các
   * phần (`CatalogItem.category`) đã dạy trong tháng. Vắng mặt = trộn theo
   * khuôn đề thật, không giới hạn.
   */
  scope?: { categories: string[] };
  slots: DeTaoSlot[];
  /** Ghi chú tự do của giáo viên về đề này. */
  note: string;
}

/**
 * Khoá ngữ cảnh dạy: một niên khoá + một lớp ghép thành một chuỗi để làm khoá
 * trong `AppData.daChua`. Dùng hàm này ở MỌI chỗ, không tự ghép chuỗi — hai
 * chỗ ghép hai kiểu là dữ liệu tách làm đôi.
 */
export function khoaLop(nienKhoa: string, lop: string): string {
  return `${nienKhoa}|${lop}`;
}

/** Tách ngược khoá ngữ cảnh thành {nienKhoa, lop} để hiển thị. */
export function tachKhoaLop(khoa: string): { nienKhoa: string; lop: string } {
  const idx = khoa.indexOf("|");
  if (idx < 0) return { nienKhoa: khoa, lop: "" };
  return { nienKhoa: khoa.slice(0, idx), lop: khoa.slice(idx + 1) };
}
