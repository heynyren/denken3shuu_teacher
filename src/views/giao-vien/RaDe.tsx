/**
 * BẢN GIÁO VIÊN — hộp "Ra đề hàng tháng", mở từ Cài đặt.
 *
 * Dòng làm việc: chọn môn → (tuỳ chọn) giới hạn theo các phần đã dạy trong
 * tháng, sửa bảng phân bố app gợi ý → Trộn đề → xem từng câu, câu nào chưa ưng
 * thì trộn lại riêng câu đó → đặt nhãn tháng, Lưu đề. Đề đã lưu nằm ngay dưới,
 * copy được ra Markdown (kèm link đề gốc) để đi biên soạn.
 */

import { ClipboardCopy, Dices, RefreshCw, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Ic } from "../../components/ui/icon";
import { Stars, openLink } from "../../components/ui";
import { subjectName, subjectViName, subjects, itemById } from "../../lib/catalog";
import type { SubjectKey } from "../../lib/types";
import type { Store } from "../../state/useStore";
import { t, t2 } from "../../lib/chu";
import { LOAI_TEN, loaiCau } from "../../lib/giao-vien/loai-cau";
import {
  cacPhanCuaMon,
  goiYPhanBo,
  soCauChuan,
  tronLaiCauKhuon,
  tronLaiCauPhamVi,
  tronTheoKhuon,
  tronTheoPhamVi,
  type KetQuaTron,
  type PhanBo,
} from "../../lib/giao-vien/ra-de";
import type { DeTao } from "../../lib/giao-vien/types";
import { deTaoMarkdown } from "../../lib/giao-vien/xuat-md";

function newId(): string {
  return `detao-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function RaDe({ store, onClose }: { store: Store; onClose(): void }) {
  const data = store.data!;

  const [subject, setSubject] = useState<SubjectKey>("kikai");
  /** false = theo khuôn đề thật; true = giới hạn theo phần đã dạy. */
  const [gioiHan, setGioiHan] = useState(false);
  const [phanChon, setPhanChon] = useState<Set<string>>(new Set());
  const [phanBo, setPhanBo] = useState<PhanBo>({});
  const [goiYCanhBao, setGoiYCanhBao] = useState<string[]>([]);
  const [ketQua, setKetQua] = useState<KetQuaTron | null>(null);
  const [thang, setThang] = useState("");
  const [note, setNote] = useState("");
  const [thongBao, setThongBao] = useState("");

  // Bấm Esc là đóng, cùng nết với hộp Giới thiệu.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /** Bài đã nằm trong các đề trộn trước — để né khi rút bài mới. */
  const daDungTruoc = useMemo(() => {
    const ids = new Set<string>();
    for (const de of data.deTao) for (const slot of de.slots) ids.add(slot.itemId);
    return ids;
  }, [data.deTao]);

  const cacPhan = useMemo(() => cacPhanCuaMon(subject), [subject]);
  const chuan = soCauChuan(subject);

  const doiMon = (key: SubjectKey) => {
    setSubject(key);
    setPhanChon(new Set());
    setPhanBo({});
    setGoiYCanhBao([]);
    setKetQua(null);
  };

  const bamPhan = (ten: string) => {
    setPhanChon((cu) => {
      const moi = new Set(cu);
      if (moi.has(ten)) moi.delete(ten);
      else moi.add(ten);
      // Đổi phạm vi là bảng phân bố cũ hết giá trị — gợi ý lại từ đầu.
      const goiY = goiYPhanBo(subject, [...moi]);
      setPhanBo(goiY.phanBo);
      setGoiYCanhBao(goiY.canhBao);
      setKetQua(null);
      return moi;
    });
  };

  const suaPhanBo = (phan: string, phanVung: "a" | "b", giaTri: number) => {
    setPhanBo((cu) => ({
      ...cu,
      [phan]: { ...cu[phan]!, [phanVung]: Math.max(0, Math.floor(giaTri) || 0) },
    }));
  };

  const tongPhanBo = Object.values(phanBo).reduce(
    (s, m) => ({ a: s.a + m.a, b: s.b + m.b }),
    { a: 0, b: 0 },
  );

  const tron = () => {
    setThongBao("");
    setKetQua(
      gioiHan
        ? tronTheoPhamVi(subject, phanBo, daDungTruoc)
        : tronTheoKhuon(subject, daDungTruoc),
    );
  };

  const tronLaiMot = (index: number) => {
    if (!ketQua) return;
    const o = ketQua.slots[index]!;
    const dangCo = new Set(
      ketQua.slots.flatMap((s) => (s.item ? [s.item.id] : [])),
    );
    const moi = gioiHan
      ? tronLaiCauPhamVi(subject, o, dangCo, daDungTruoc)
      : tronLaiCauKhuon(subject, o.no, dangCo, daDungTruoc);
    if (!moi) {
      setThongBao(t2("問{n}: không còn bài nào khác để thay.", { n: o.no }));
      return;
    }
    setKetQua({
      ...ketQua,
      slots: ketQua.slots.map((s, i) => (i === index ? { ...s, item: moi } : s)),
    });
  };

  const luuDe = () => {
    if (!ketQua) return;
    const slots = ketQua.slots.flatMap((s) =>
      s.item ? [{ no: s.no, itemId: s.item.id }] : [],
    );
    if (slots.length === 0) return;
    const entry: DeTao = {
      id: newId(),
      createdAt: new Date().toISOString(),
      subject,
      thang: thang.trim(),
      ...(gioiHan ? { scope: { categories: [...phanChon] } } : {}),
      slots,
      note: note.trim(),
    };
    store.saveDeTao(entry);
    setKetQua(null);
    setThang("");
    setNote("");
    setThongBao(t("Đã lưu đề. Kéo xuống dưới để xem lại hoặc copy Markdown."));
  };

  const copyMarkdown = async (de: DeTao) => {
    try {
      await navigator.clipboard.writeText(deTaoMarkdown(de));
      setThongBao(t("Đã copy đề dạng Markdown vào clipboard."));
    } catch {
      setThongBao(t("Không copy được — trình duyệt chặn clipboard."));
    }
  };

  const soCauDaCo = ketQua ? ketQua.slots.filter((s) => s.item).length : 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal rong"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ra-de-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div id="ra-de-title" className="modal-title">
              {t("Ra đề hàng tháng")}
            </div>
            <div className="small dim">
              {t("Trộn câu hỏi từ 25 kỳ thi thật thành một đề mới, theo đúng cấu trúc đề thật.")}
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} title={t("Đóng (Esc)")}>
            <Ic i={X} />
          </button>
        </div>

        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14, padding: 16 }}>
          {/* Môn */}
          <div className="chip-row">
            {subjects.map((entry) => (
              <button
                key={entry.key}
                className={`chip${subject === entry.key ? " on" : ""}`}
                onClick={() => doiMon(entry.key)}
              >
                <span className="ja">{entry.name}</span> {entry.viName}
              </button>
            ))}
            <span className="small dim nowrap">
              {t2("Đề thật: {tong} câu ({a} A問題 + {b} B問題)", {
                tong: chuan.tong,
                a: chuan.a,
                b: chuan.b,
              })}
            </span>
          </div>

          {/* Chế độ */}
          <div className="chip-row">
            <button
              className={`chip${!gioiHan ? " on" : ""}`}
              onClick={() => {
                setGioiHan(false);
                setKetQua(null);
              }}
            >
              {t("Theo khuôn đề thật")}
            </button>
            <button
              className={`chip${gioiHan ? " on" : ""}`}
              onClick={() => {
                setGioiHan(true);
                setKetQua(null);
              }}
            >
              {t("Giới hạn theo phần đã dạy trong tháng")}
            </button>
          </div>

          {/* Phạm vi + bảng phân bố */}
          {gioiHan && (
            <>
              <div>
                <div className="field-label" style={{ marginBottom: 6 }}>
                  {t("Các phần đã dạy")}
                </div>
                <div className="chip-row">
                  {cacPhan.map((phan) => (
                    <button
                      key={phan.ten}
                      className={`chip${phanChon.has(phan.ten) ? " on" : ""}`}
                      onClick={() => bamPhan(phan.ten)}
                      title={t2("{n} bài trong kho", { n: phan.soBai })}
                    >
                      <span className="ja">{phan.ten}</span>
                      <span className="dim"> {phan.soBai}</span>
                    </button>
                  ))}
                </div>
              </div>

              {phanChon.size > 0 && (
                <div>
                  <div className="field-label" style={{ marginBottom: 6 }}>
                    {t("Phân bố gợi ý — sửa được, tổng nên bằng số câu đề thật")}
                  </div>
                  <table className="ra-de-bang">
                    <thead>
                      <tr>
                        <th>{t("Phần")}</th>
                        <th>A問題</th>
                        <th>B問題</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...phanChon].map((phan) => (
                        <tr key={phan}>
                          <td className="ja">{phan}</td>
                          <td>
                            <input
                              className="input ra-de-so"
                              type="number"
                              min={0}
                              value={phanBo[phan]?.a ?? 0}
                              onChange={(e) => suaPhanBo(phan, "a", Number(e.target.value))}
                            />
                          </td>
                          <td>
                            <input
                              className="input ra-de-so"
                              type="number"
                              min={0}
                              value={phanBo[phan]?.b ?? 0}
                              onChange={(e) => suaPhanBo(phan, "b", Number(e.target.value))}
                            />
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td>
                          <strong>{t("Tổng")}</strong>
                        </td>
                        <td className={tongPhanBo.a === chuan.a ? "" : "ra-de-lech"}>
                          {tongPhanBo.a} / {chuan.a}
                        </td>
                        <td className={tongPhanBo.b === chuan.b ? "" : "ra-de-lech"}>
                          {tongPhanBo.b} / {chuan.b}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="btn-row" style={{ marginTop: 8 }}>
                    <button
                      className="btn ghost sm"
                      onClick={() => {
                        const goiY = goiYPhanBo(subject, [...phanChon]);
                        setPhanBo(goiY.phanBo);
                        setGoiYCanhBao(goiY.canhBao);
                      }}
                    >
                      <Ic i={RefreshCw} /> {t("Gợi ý lại")}
                    </button>
                  </div>
                </div>
              )}

              {goiYCanhBao.length > 0 && (
                <div className="field-hint">
                  {goiYCanhBao.map((line, i) => (
                    <div key={i}>⚠ {line}</div>
                  ))}
                </div>
              )}
            </>
          )}

          <div className="btn-row">
            <button
              className="btn primary"
              onClick={tron}
              disabled={gioiHan && phanChon.size === 0}
            >
              <Ic i={Dices} /> {t("Trộn đề")}
            </button>
            {thongBao && <span className="small dim">{thongBao}</span>}
          </div>

          {/* Kết quả trộn */}
          {ketQua && (
            <div>
              <div className="field-label" style={{ marginBottom: 6 }}>
                {t2("Đề vừa trộn — {n}/{tong} câu", { n: soCauDaCo, tong: chuan.tong })}
              </div>
              {ketQua.canhBao.length > 0 && (
                <div className="field-hint" style={{ marginBottom: 8 }}>
                  {ketQua.canhBao.map((line, i) => (
                    <div key={i}>⚠ {line}</div>
                  ))}
                </div>
              )}
              <div className="ra-de-ds">
                {ketQua.slots.map((slot, index) => (
                  <div key={slot.no} className="ra-de-cau">
                    <span className="ra-de-so-cau">
                      問{slot.no}
                      {slot.partB && <span className="dim"> B</span>}
                    </span>
                    {slot.item ? (
                      <div className="ra-de-cau-chinh">
                        <div className="ja">{slot.item.name}</div>
                        {slot.item.nameVi && (
                          <div className="small dim">{slot.item.nameVi}</div>
                        )}
                        <div className="small dim">
                          {slot.item.exam} {slot.item.question} ·{" "}
                          <span className="ja">{slot.item.category}</span> ·{" "}
                          {LOAI_TEN[loaiCau(slot.item)]}
                          {daDungTruoc.has(slot.item.id) && (
                            <> · {t("đã ra ở đề trước")}</>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="ra-de-cau-chinh small dim">
                        {t("— không lấp được ô này —")}
                      </div>
                    )}
                    {slot.item && <Stars count={slot.item.stars} />}
                    <button
                      className="icon-btn"
                      title={t("Trộn lại riêng câu này")}
                      onClick={() => tronLaiMot(index)}
                    >
                      <Ic i={Dices} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="row wrap" style={{ gap: 8, marginTop: 12 }}>
                <input
                  className="input"
                  style={{ maxWidth: 220 }}
                  placeholder={t("Nhãn tháng, ví dụ: Tháng 10/2026")}
                  value={thang}
                  onChange={(e) => setThang(e.target.value)}
                />
                <input
                  className="input"
                  style={{ flex: 1, minWidth: 180 }}
                  placeholder={t("Ghi chú cho đề này (tuỳ chọn)")}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <button className="btn success" onClick={luuDe} disabled={soCauDaCo === 0}>
                  {t("Lưu đề")}
                </button>
              </div>
            </div>
          )}

          {/* Đề đã lưu */}
          <DeTaoList store={store} onCopy={copyMarkdown} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function DeTaoList({
  store,
  onCopy,
}: {
  store: Store;
  onCopy(de: DeTao): void;
}) {
  const data = store.data!;
  const [moRong, setMoRong] = useState<string | null>(null);

  if (data.deTao.length === 0) return null;

  // Mới lưu hiện trước.
  const ds = [...data.deTao].reverse();

  return (
    <div>
      <div className="field-label" style={{ marginBottom: 6 }}>
        {t2("Đề đã lưu ({n})", { n: ds.length })}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ds.map((de) => (
          <div key={de.id} className="ra-de-luu">
            <div className="row" style={{ gap: 8 }}>
              <button
                className="ra-de-luu-ten"
                onClick={() => setMoRong((cu) => (cu === de.id ? null : de.id))}
              >
                <strong>
                  {de.thang || de.createdAt.slice(0, 10)}
                </strong>{" "}
                — <span className="ja">{subjectName(de.subject)}</span>{" "}
                {subjectViName(de.subject)} · {t2("{n} câu", { n: de.slots.length })}
                {de.scope && (
                  <span className="small dim">
                    {" "}
                    · {t("giới hạn:")} <span className="ja">{de.scope.categories.join(", ")}</span>
                  </span>
                )}
              </button>
              <span className="spacer" />
              <button className="icon-btn" title={t("Copy đề dạng Markdown")} onClick={() => onCopy(de)}>
                <Ic i={ClipboardCopy} />
              </button>
              <button
                className="icon-btn"
                title={t("Xoá đề này")}
                onClick={() => store.removeDeTao(de.id)}
              >
                <Ic i={Trash2} />
              </button>
            </div>
            {moRong === de.id && (
              <div className="ra-de-ds" style={{ marginTop: 8 }}>
                {de.slots.map((slot) => {
                  const item = itemById.get(slot.itemId);
                  if (!item) {
                    return (
                      <div key={slot.no} className="ra-de-cau small dim">
                        問{slot.no} — {t("bài không còn trong danh mục")}
                      </div>
                    );
                  }
                  return (
                    <div key={slot.no} className="ra-de-cau">
                      <span className="ra-de-so-cau">問{slot.no}</span>
                      <div className="ra-de-cau-chinh">
                        <div className="ja">{item.name}</div>
                        {item.nameVi && <div className="small dim">{item.nameVi}</div>}
                        <div className="small dim">
                          {item.exam} {item.question} ·{" "}
                          <span className="ja">{item.category}</span> ·{" "}
                          {LOAI_TEN[loaiCau(item)]}
                        </div>
                      </div>
                      <Stars count={item.stars} />
                      <button
                        className="icon-btn"
                        title={t("Mở bài trên denken-ou.com")}
                        onClick={() => openLink(item.url)}
                      >
                        ↗
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
