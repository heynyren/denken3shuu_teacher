/**
 * BẢN GIÁO VIÊN — trộn đề thi thử hàng tháng từ kho 25 kỳ thi thật.
 *
 * Hai chế độ:
 *
 * 1. THEO KHUÔN ĐỀ THẬT (`tronTheoKhuon`): mỗi vị trí câu 問1..問N có một
 *    "hồ" là MỌI bài lịch sử từng nằm đúng vị trí đó qua các kỳ. Rút ngẫu
 *    nhiên từ hồ là tự được đúng phân bố phần / độ khó / dạng bài của vị trí
 *    đó — hồ CHÍNH LÀ lịch sử, không cần mô phỏng lại. Thống kê kèm theo chỉ
 *    để giải thích cho giáo viên vì sao câu này hợp chỗ này.
 *
 * 2. GIỚI HẠN PHẠM VI (`goiYPhanBo` + `tronTheoPhamVi`): tháng này chỉ dạy
 *    vài phần thì đề chỉ lấy bài các phần đó, nhưng vẫn đủ số câu và đúng cấu
 *    trúc A問題/B問題 của đề thật. Vì khuôn theo-vị-trí không còn dùng được
 *    (phần đã chọn không phủ đủ 18 vị trí), app GỢI Ý phân bố: chia số câu
 *    cho từng phần theo tần suất phần đó trong lịch sử toàn môn, giữ phổ độ
 *    khó và tỷ lệ dạng bài sát mức trung bình của môn. Giáo viên sửa bảng
 *    phân bố rồi mới trộn.
 *
 * Luật chung khi rút bài:
 *   - CỨNG: một đề không có hai câu trùng nhau.
 *   - MỀM:  bài đã nằm trong đề trộn trước đây bị giảm mạnh trọng số (×0.15)
 *           — ưu tiên câu chưa ra bao giờ nhưng không cấm hẳn, cấm hẳn thì hồ
 *           mỏng là bí.
 *   - MỀM:  càng lấy nhiều câu từ cùng một kỳ gốc càng bị giảm trọng số —
 *           tránh "đề trộn" hoá ra chép nửa đề R05上.
 */

import { items } from "../catalog";
import { STANDARD_QUESTIONS, questionNo } from "../exam";
import { B_QUESTIONS } from "../timing";
import type { CatalogItem, SubjectKey } from "../types";
import { loaiCau, type LoaiCau } from "./loai-cau";

/* ------------------------------------------------------------------ */
/* Kiểu kết quả                                                        */
/* ------------------------------------------------------------------ */

/** Một ô câu trong đề đang trộn. `item` null = ô không lấp được, có cảnh báo. */
export interface OCau {
  no: number;
  partB: boolean;
  item: CatalogItem | null;
  /** Chế độ giới hạn phạm vi: ô này được chia cho phần nào (để trộn lại). */
  category?: string;
}

export interface KetQuaTron {
  slots: OCau[];
  /** Chuyện cần nói với giáo viên: hồ mỏng, phải nới độ khó, thiếu câu… */
  canhBao: string[];
}

/* ------------------------------------------------------------------ */
/* Khuôn theo vị trí câu (chế độ 1)                                    */
/* ------------------------------------------------------------------ */

export interface ThongKeViTri {
  no: number;
  partB: boolean;
  /** Mọi bài lịch sử từng mang đúng số câu này trong môn. */
  pool: CatalogItem[];
  /** Phần nào từng ra ở vị trí này, bao nhiêu lần — chỉ để hiển thị. */
  theoPhan: Record<string, number>;
  theoLoai: Partial<Record<LoaiCau, number>>;
  saoMin: number;
  saoMax: number;
}

const khuonNho = new Map<SubjectKey, ThongKeViTri[]>();

export function khuonMon(subject: SubjectKey): ThongKeViTri[] {
  const co = khuonNho.get(subject);
  if (co) return co;

  const total = STANDARD_QUESTIONS[subject];
  const cuaMon = items.filter((it) => it.subject === subject);
  const khuon: ThongKeViTri[] = [];
  for (let no = 1; no <= total; no += 1) {
    const pool = cuaMon.filter((it) => questionNo(it) === no);
    const theoPhan: Record<string, number> = {};
    const theoLoai: Partial<Record<LoaiCau, number>> = {};
    let saoMin = 5;
    let saoMax = 1;
    for (const it of pool) {
      theoPhan[it.category] = (theoPhan[it.category] ?? 0) + 1;
      const loai = loaiCau(it);
      theoLoai[loai] = (theoLoai[loai] ?? 0) + 1;
      if (it.stars < saoMin) saoMin = it.stars;
      if (it.stars > saoMax) saoMax = it.stars;
    }
    khuon.push({
      no,
      partB: B_QUESTIONS[subject]?.has(no) ?? false,
      pool,
      theoPhan,
      theoLoai,
      saoMin: pool.length > 0 ? saoMin : 0,
      saoMax: pool.length > 0 ? saoMax : 0,
    });
  }
  khuonNho.set(subject, khuon);
  return khuon;
}

/* ------------------------------------------------------------------ */
/* Rút có trọng số                                                     */
/* ------------------------------------------------------------------ */

function rutCoTrongSo<T>(candidates: T[], trongSo: (x: T) => number): T | null {
  if (candidates.length === 0) return null;
  const weights = candidates.map((x) => Math.max(trongSo(x), 0.0001));
  let con = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < candidates.length; i += 1) {
    con -= weights[i]!;
    if (con <= 0) return candidates[i]!;
  }
  return candidates[candidates.length - 1]!;
}

/** Trọng số chung: né bài đã dùng ở đề trước, né dồn câu về một kỳ gốc. */
function trongSoChung(
  it: CatalogItem,
  daDungTruoc: ReadonlySet<string>,
  soCauTheoKy: ReadonlyMap<string, number>,
): number {
  let w = 1;
  if (daDungTruoc.has(it.id)) w *= 0.15;
  w /= 1 + (soCauTheoKy.get(it.exam) ?? 0);
  return w;
}

/* ------------------------------------------------------------------ */
/* Chế độ 1: trộn theo khuôn đề thật                                   */
/* ------------------------------------------------------------------ */

export function tronTheoKhuon(
  subject: SubjectKey,
  daDungTruoc: ReadonlySet<string>,
): KetQuaTron {
  const khuon = khuonMon(subject);
  const daLay = new Set<string>();
  const theoKy = new Map<string, number>();
  const canhBao: string[] = [];

  const slots: OCau[] = khuon.map((vitri) => {
    const ung = vitri.pool.filter((it) => !daLay.has(it.id));
    const item = rutCoTrongSo(ung, (it) => trongSoChung(it, daDungTruoc, theoKy));
    if (!item) {
      canhBao.push(`問${vitri.no}: không còn bài lịch sử nào cho vị trí này.`);
      return { no: vitri.no, partB: vitri.partB, item: null };
    }
    daLay.add(item.id);
    theoKy.set(item.exam, (theoKy.get(item.exam) ?? 0) + 1);
    return { no: vitri.no, partB: vitri.partB, item };
  });

  return { slots, canhBao };
}

/** Trộn lại MỘT ô của đề theo khuôn, giữ luật không trùng với các ô còn lại. */
export function tronLaiCauKhuon(
  subject: SubjectKey,
  no: number,
  /** id mọi bài đang nằm trong đề (kể cả bài đang bị thay). */
  dangCo: ReadonlySet<string>,
  daDungTruoc: ReadonlySet<string>,
): CatalogItem | null {
  const vitri = khuonMon(subject).find((v) => v.no === no);
  if (!vitri) return null;
  const ung = vitri.pool.filter((it) => !dangCo.has(it.id));
  return rutCoTrongSo(ung, (it) => trongSoChung(it, daDungTruoc, new Map()));
}

/* ------------------------------------------------------------------ */
/* Chế độ 2: giới hạn phạm vi theo phần đã dạy                         */
/* ------------------------------------------------------------------ */

/** Bài của môn nằm ở phân vùng nào — theo SỐ CÂU GỐC của nó trong đề thật. */
function laCauB(it: CatalogItem): boolean {
  return B_QUESTIONS[it.subject]?.has(questionNo(it)) ?? false;
}

/** Các phần (`category`) của một môn, kèm số bài, nhiều bài trước. */
export function cacPhanCuaMon(
  subject: SubjectKey,
): Array<{ ten: string; soBai: number }> {
  const dem = new Map<string, number>();
  for (const it of items) {
    if (it.subject !== subject) continue;
    // Vài bài cũ không ghi phần — không thành chip trống trong bảng chọn.
    if (!it.category.trim()) continue;
    dem.set(it.category, (dem.get(it.category) ?? 0) + 1);
  }
  return [...dem.entries()]
    .map(([ten, soBai]) => ({ ten, soBai }))
    .sort((a, b) => b.soBai - a.soBai);
}

/** Số câu mỗi phần, tách A問題/B問題. */
export interface PhanBoMuc {
  a: number;
  b: number;
}
export type PhanBo = Record<string, PhanBoMuc>;

export function soCauChuan(subject: SubjectKey): { a: number; b: number; tong: number } {
  const tong = STANDARD_QUESTIONS[subject];
  const b = B_QUESTIONS[subject]?.size ?? 0;
  return { a: tong - b, b, tong };
}

/**
 * Chia `total` chỗ cho các phần theo trọng số, làm tròn kiểu LARGEST REMAINDER
 * để tổng ra đúng `total` — cùng tinh thần với cách `pointsFor` chia 30/40
 * điểm cho số câu B thay đổi mà không bị trôi tổng.
 */
function chiaTronTong(trongSo: Record<string, number>, total: number): Record<string, number> {
  const ten = Object.keys(trongSo);
  const tong = ten.reduce((s, k) => s + trongSo[k]!, 0);
  const out: Record<string, number> = {};
  if (total <= 0 || ten.length === 0) {
    for (const k of ten) out[k] = 0;
    return out;
  }
  if (tong <= 0) {
    // Không có lịch sử để dựa: chia đều, dư dồn từ đầu danh sách.
    const moi = Math.floor(total / ten.length);
    let du = total - moi * ten.length;
    for (const k of ten) {
      out[k] = moi + (du > 0 ? 1 : 0);
      if (du > 0) du -= 1;
    }
    return out;
  }
  const phanDu: Array<{ k: string; du: number }> = [];
  let daChia = 0;
  for (const k of ten) {
    const chinhXac = (trongSo[k]! / tong) * total;
    const nguyen = Math.floor(chinhXac);
    out[k] = nguyen;
    daChia += nguyen;
    phanDu.push({ k, du: chinhXac - nguyen });
  }
  phanDu.sort((x, y) => y.du - x.du);
  for (let i = 0; i < total - daChia; i += 1) {
    const k = phanDu[i % phanDu.length]!.k;
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

/**
 * Gợi ý phân bố số câu khi giới hạn phạm vi: mỗi phần nhận số câu tỷ lệ với
 * TẦN SUẤT LỊCH SỬ của phần đó trong toàn môn (đếm riêng phân vùng A/B), để
 * phần hay ra nhiều câu hơn phần hiếm — đề trộn ra vẫn "có mùi" đề thật.
 */
export function goiYPhanBo(
  subject: SubjectKey,
  cacPhan: string[],
): { phanBo: PhanBo; canhBao: string[] } {
  const chuan = soCauChuan(subject);
  const canhBao: string[] = [];

  const demA: Record<string, number> = {};
  const demB: Record<string, number> = {};
  for (const phan of cacPhan) {
    demA[phan] = 0;
    demB[phan] = 0;
  }
  for (const it of items) {
    if (it.subject !== subject) continue;
    if (!(it.category in demA)) continue;
    if (laCauB(it)) demB[it.category] = (demB[it.category] ?? 0) + 1;
    else demA[it.category] = (demA[it.category] ?? 0) + 1;
  }

  const chiaA = chiaTronTong(demA, chuan.a);
  const chiaB = chiaTronTong(demB, chuan.b);

  const phanBo: PhanBo = {};
  for (const phan of cacPhan) {
    phanBo[phan] = { a: chiaA[phan] ?? 0, b: chiaB[phan] ?? 0 };
    if (demB[phan] === 0 && (chiaB[phan] ?? 0) === 0 && chuan.b > 0) {
      // Không phải lỗi: phần này trong lịch sử chưa từng ra ở B問題.
    }
  }

  // Phần được chia nhiều câu hơn số bài đang có thì không lấp nổi — báo sớm
  // ngay từ bảng gợi ý chứ không đợi bấm trộn mới lộ.
  for (const phan of cacPhan) {
    if ((phanBo[phan]!.a ?? 0) > demA[phan]!) {
      canhBao.push(
        `Phần ${phan}: gợi ý ${phanBo[phan]!.a} câu A nhưng kho chỉ có ${demA[phan]} bài.`,
      );
    }
    if ((phanBo[phan]!.b ?? 0) > demB[phan]!) {
      canhBao.push(
        `Phần ${phan}: gợi ý ${phanBo[phan]!.b} câu B nhưng kho chỉ có ${demB[phan]} bài B問題.`,
      );
    }
  }
  const tongB = cacPhan.reduce((s, p) => s + demB[p]!, 0);
  if (chuan.b > 0 && tongB < chuan.b) {
    canhBao.push(
      `Các phần đã chọn chỉ có ${tongB} bài B問題 trong lịch sử — đề thật cần ${chuan.b} câu B. ` +
        "Nên chọn thêm phần, hoặc chấp nhận đề thiếu câu B.",
    );
  }
  return { phanBo, canhBao };
}

/** Phổ độ khó và tỷ lệ dạng bài của TOÀN môn trong một phân vùng — mục tiêu chung. */
function phoMon(subject: SubjectKey, partB: boolean) {
  const sao = new Map<number, number>();
  const loai = new Map<LoaiCau, number>();
  for (const it of items) {
    if (it.subject !== subject || laCauB(it) !== partB) continue;
    sao.set(it.stars, (sao.get(it.stars) ?? 0) + 1);
    const l = loaiCau(it);
    loai.set(l, (loai.get(l) ?? 0) + 1);
  }
  return { sao, loai };
}

function xaoTron<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Trộn đề theo phân bố đã chốt (bảng gợi ý, có thể đã được giáo viên sửa tay).
 *
 * Mỗi câu nhắm một mức sao và một dạng bài rút theo phổ chung của môn, rồi nới
 * dần khi hết bài: đúng sao + đúng dạng → đúng sao → sao ±1 → còn gì lấy nấy
 * trong phần. Hết sạch bài của phần thì ô đó bỏ trống kèm cảnh báo — KHÔNG tự
 * ý lấy bài ngoài các phần đã chọn.
 */
export function tronTheoPhamVi(
  subject: SubjectKey,
  phanBo: PhanBo,
  daDungTruoc: ReadonlySet<string>,
): KetQuaTron {
  const chuan = soCauChuan(subject);
  const canhBao: string[] = [];
  const daLay = new Set<string>();
  const theoKy = new Map<string, number>();

  const soViTriB = B_QUESTIONS[subject] ? [...B_QUESTIONS[subject]] : [];
  const soViTriA: number[] = [];
  for (let n = 1; n <= chuan.tong; n += 1) {
    if (!B_QUESTIONS[subject]?.has(n)) soViTriA.push(n);
  }

  const rutMotPhanVung = (partB: boolean): Array<{ item: CatalogItem; category: string }> => {
    const pho = phoMon(subject, partB);
    const ra: Array<{ item: CatalogItem; category: string }> = [];

    for (const [phan, muc] of Object.entries(phanBo)) {
      const can = partB ? muc.b : muc.a;
      if (can <= 0) continue;
      const kho = items.filter(
        (it) => it.subject === subject && it.category === phan && laCauB(it) === partB,
      );
      for (let i = 0; i < can; i += 1) {
        const con = kho.filter((it) => !daLay.has(it.id));
        if (con.length === 0) {
          canhBao.push(
            `Phần ${phan}: hết bài ${partB ? "B問題" : "A問題"}, thiếu ${can - i} câu.`,
          );
          break;
        }
        const saoMuon = rutCoTrongSo([...pho.sao.entries()], ([, n]) => n)?.[0] ?? 3;
        const loaiMuon = rutCoTrongSo([...pho.loai.entries()], ([, n]) => n)?.[0] ?? "calc";

        // Nới dần từng nấc, nấc nào có bài thì dừng ở nấc đó.
        const cacNac = [
          con.filter((it) => it.stars === saoMuon && loaiCau(it) === loaiMuon),
          con.filter((it) => it.stars === saoMuon),
          con.filter((it) => Math.abs(it.stars - saoMuon) <= 1),
          con,
        ];
        const nac = cacNac.find((d) => d.length > 0)!;
        const item = rutCoTrongSo(nac, (it) => trongSoChung(it, daDungTruoc, theoKy))!;
        daLay.add(item.id);
        theoKy.set(item.exam, (theoKy.get(item.exam) ?? 0) + 1);
        ra.push({ item, category: phan });
      }
    }
    return ra;
  };

  const cauA = rutMotPhanVung(false);
  const cauB = rutMotPhanVung(true);

  // Trải câu đã rút lên các số câu của phân vùng, thứ tự ngẫu nhiên — đề thật
  // không xếp các câu cùng phần dính chùm nhau.
  const slots: OCau[] = [];
  const gan = (
    soViTri: number[],
    cau: Array<{ item: CatalogItem; category: string }>,
    partB: boolean,
  ) => {
    const tron = xaoTron(cau);
    soViTri.forEach((no, i) => {
      const c = tron[i];
      slots.push(
        c
          ? { no, partB, item: c.item, category: c.category }
          : { no, partB, item: null },
      );
    });
  };
  gan(soViTriA, cauA, false);
  gan(soViTriB, cauB, true);
  slots.sort((x, y) => x.no - y.no);

  const thieu = slots.filter((s) => !s.item).length;
  if (thieu > 0) {
    canhBao.push(
      `Đề thiếu ${thieu}/${chuan.tong} câu vì kho các phần đã chọn không đủ. ` +
        "Chọn thêm phần rồi trộn lại, hoặc chấp nhận đề ngắn (ghi rõ khi in).",
    );
  }
  return { slots, canhBao };
}

/** Trộn lại MỘT ô của đề giới hạn phạm vi: giữ đúng phần và phân vùng của ô. */
export function tronLaiCauPhamVi(
  subject: SubjectKey,
  o: OCau,
  dangCo: ReadonlySet<string>,
  daDungTruoc: ReadonlySet<string>,
): CatalogItem | null {
  if (!o.category) return null;
  const kho = items.filter(
    (it) =>
      it.subject === subject &&
      it.category === o.category &&
      laCauB(it) === o.partB &&
      !dangCo.has(it.id),
  );
  return rutCoTrongSo(kho, (it) => trongSoChung(it, daDungTruoc, new Map()));
}
