/**
 * BẢN GIÁO VIÊN — xuất một đề trộn thành đoạn Google Apps Script tạo Google Form
 * (dạng Quiz) để gửi cho sinh viên.
 *
 * Ý đồ của form sinh ra:
 * - Câu hỏi CHỈ trỏ tới đề PDF gốc trên shiken.or.jp (電気技術者試験センター) và
 *   ghi rõ phải làm 問 nào trong file đó. KHÔNG để link denken-ou ở đề bài — mở
 *   ra là thấy luôn lời giải, hỏng buổi test.
 * - Link denken-ou (có lời giải) chỉ hiện ở PHẢN HỒI sau khi nộp, để sinh viên
 *   tham khảo cách giải.
 * - Là Quiz có sẵn đáp án: tự chấm điểm theo số câu, quy về thang 100.
 * - Có ô "Họ và tên" bắt buộc + thu email, nên biết ai đã nộp; Google Form tự
 *   ghi mốc thời gian nộp (cột Timestamp) nên biết thời điểm làm bài.
 *
 * Vì sao xuất "đoạn mã" chứ không gọi API: máy giáo viên không cần cấu hình gì,
 * chỉ dán vào script.google.com rồi Run. Dữ liệu đề nhúng thẳng dạng JSON nên
 * đoạn mã tự đứng một mình, không phụ thuộc app.
 */

import answersFile from "../../data/answers.json";
import { itemById, subjectName, subjectViName } from "../catalog";
import { linkDeThi } from "../de-thi";
import type { AnswerKey } from "../exam";
import type { DeTao } from "./types";

const ANSWERS = (answersFile as { answers: AnswerKey }).answers;

/** Một ô câu trong dữ liệu nhúng vào Apps Script. */
interface CauForm {
  /** Số câu trong đề trộn (問X). */
  no: number;
  /** Nhãn câu gốc trong đề PDF, ví dụ "問1". */
  bai: string;
  /** Link đề PDF gốc trên shiken.or.jp; rỗng nếu chưa có. */
  pdf: string;
  /** Kỳ thi gốc, để ghi khi thiếu link PDF. */
  ky: string;
  /** Link denken-ou có lời giải — chỉ dùng ở phản hồi. */
  giai: string;
  /** Đáp án đúng cho từng ô con (1..5). Dài 1 với A問題, dài 2 với B問題 (a)(b). */
  dapAn: number[];
}

/** Đầu đề form: "Quiz Test" + tên phần + ngày ra đề. */
export function tieuDeForm(de: DeTao): string {
  const ngay = (de.thang || de.createdAt.slice(0, 10)).trim();
  const phan = `${subjectName(de.subject)} ${subjectViName(de.subject)}`.trim();
  return `Quiz Test ${phan}${ngay ? " · " + ngay : ""}`;
}

function cauCuaDe(de: DeTao): CauForm[] {
  const ds: CauForm[] = [];
  for (const slot of de.slots) {
    const item = itemById.get(slot.itemId);
    if (!item) continue;
    const dapAn = (ANSWERS[item.id] ?? []).filter(
      (x): x is number => typeof x === "number" && x >= 1 && x <= 5,
    );
    if (dapAn.length === 0) continue;
    ds.push({
      no: slot.no,
      bai: item.question,
      pdf: linkDeThi(item.exam, item.subject) ?? "",
      ky: item.exam,
      giai: item.url,
      dapAn,
    });
  }
  return ds;
}

/**
 * Sinh đoạn Apps Script. Toàn bộ logic dựng form nằm trong đoạn mã sinh ra;
 * ở đây chỉ nhúng tiêu đề + mảng câu hỏi dạng JSON.
 */
export function deTaoAppsScript(de: DeTao): string {
  const tieuDe = tieuDeForm(de);
  const cau = cauCuaDe(de);
  const moTaDong = [
    `Đề trộn ${subjectName(de.subject)} ${subjectViName(de.subject)}${de.thang ? " — " + de.thang : ""}.`,
    "Mỗi câu: mở đề PDF chính thức ở phần hướng dẫn, làm đúng 問 được chỉ định rồi chọn đáp án.",
    "Điền Họ và tên trước khi nộp. Điểm và link lời giải (denken-ou) hiện sau khi nộp.",
  ];
  if (de.note) moTaDong.push("", de.note);
  const moTa = moTaDong.join("\n");

  return `/**
 * Google Apps Script tạo Google Form (Quiz): ${tieuDe}
 * Sinh tự động từ app 電験三種 — bản giáo viên.
 *
 * CÁCH DÙNG
 *   1. Mở https://script.google.com  →  New project.
 *   2. Xoá code mẫu, dán TOÀN BỘ đoạn này vào, bấm Save.
 *   3. Chọn hàm "taoForm" ở thanh trên, bấm Run. Lần đầu Google hỏi quyền → Allow.
 *   4. Xem tab "Execution log": có 2 link — link sửa form và link gửi sinh viên.
 *
 * ĐỂ HIỆN ĐIỂM + LỜI GIẢI NGAY SAU KHI NỘP
 *   Mở form → Settings → mục Quiz đã bật sẵn → "Release marks: Immediately after
 *   each submission". Khi đó phản hồi (kèm link denken-ou) mới hiện cho sinh viên.
 *
 * CHẤM ĐIỂM: tự chấm theo số câu, chia đều về thang 100.
 * BIẾT AI NỘP + KHI NÀO: form thu email + có ô Họ tên bắt buộc; cột Timestamp
 * trong bảng phản hồi là thời điểm nộp bài.
 */

function taoForm() {
  var TIEU_DE = ${JSON.stringify(tieuDe)};
  var MO_TA = ${JSON.stringify(moTa)};

  // Mỗi phần tử là một câu trong đề. dapAn: đáp án đúng của từng ô con (1..5).
  var CAU = ${JSON.stringify(cau, null, 2).replace(/\n/g, "\n  ")};

  if (CAU.length === 0) {
    throw new Error("Đề không có câu nào có đáp án — không tạo được form.");
  }

  var form = FormApp.create(TIEU_DE);
  form.setIsQuiz(true);
  form.setTitle(TIEU_DE);
  form.setDescription(MO_TA);
  form.setCollectEmail(true);          // biết ai nộp
  form.setLimitOneResponsePerUser(false);

  // Họ và tên — biết ai nộp kể cả khi email không dùng được.
  form.addTextItem().setTitle("Họ và tên").setRequired(true);

  // Thang điểm 100 chia đều cho từng ô con; dư bao nhiêu dồn cho các câu đầu.
  var tongO = 0;
  for (var i = 0; i < CAU.length; i++) tongO += CAU[i].dapAn.length;
  var diemCoBan = Math.floor(100 / tongO);
  var du = 100 - diemCoBan * tongO;

  var LUA_CHON = ["①", "②", "③", "④", "⑤"]; // ①②③④⑤
  var TEN_O = ["(a)", "(b)", "(c)", "(d)", "(e)"];
  var soThuTuO = 0;

  CAU.forEach(function (c) {
    var nhieuO = c.dapAn.length > 1;
    var huong = c.pdf
      ? "Mở đề PDF chính thức rồi làm " + c.bai + ": " + c.pdf
      : "Làm " + c.bai + " trong đề kỳ " + c.ky + " (đề PDF chính thức trên shiken.or.jp).";

    for (var k = 0; k < c.dapAn.length; k++) {
      var nhanO = nhieuO ? " " + TEN_O[k] : "";
      var item = form.addMultipleChoiceItem();
      item.setTitle("問" + c.no + nhanO);
      item.setHelpText(huong);
      item.setRequired(true);

      var dung = c.dapAn[k];
      var choices = LUA_CHON.map(function (nhan, idx) {
        return item.createChoice(nhan, idx + 1 === dung);
      });
      item.setChoices(choices);

      var diem = diemCoBan + (soThuTuO < du ? 1 : 0);
      item.setPoints(diem);
      soThuTuO++;

      var phanHoi = FormApp.createFeedback()
        .setText("Tham khảo cách giải (denken-ou): " + c.giai)
        .build();
      item.setFeedbackForCorrect(phanHoi);
      item.setFeedbackForIncorrect(phanHoi);
    }
  });

  form.setConfirmationMessage(
    "Đã nộp bài. Xem điểm và link lời giải (denken-ou) ở phần phản hồi của Google Form."
  );

  Logger.log("Link sửa form:   " + form.getEditUrl());
  Logger.log("Link gửi sinh viên: " + form.getPublishedUrl());
}
`;
}
