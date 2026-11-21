// Run: cd scripts/ingest && npm test
import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyGrade, decideGrade, splitNarrator, extractIsnadAr, embedText, contentHash, buildHadithRows, COLLECTIONS,
} from "../preprocess.ts";

const C = (slug) => COLLECTIONS.find((c) => c.slug === slug);

test("classifyGrade: only clear positive verdicts on the hadith itself count", () => {
  const ok = { "Sahih": "Sahih", "sahih": "Sahih", "Hasan": "Hasan", "Hasan Sahih": "Hasan", "Sahih - Agreed Upon": "Sahih",
    "Sahih Muslim": "Sahih", "Sahih Bukhari": "Sahih", "Sahih - Bukhari And Muslim": "Sahih", "Sahih Lighairihi": "Sahih",
    "Hasan Lighairihi": "Hasan", "Sahih Hadith": "Sahih", "Sahih Mutawatir": "Sahih" };
  for (const [raw, want] of Object.entries(ok)) assert.equal(classifyGrade(raw), want, raw);
  const rejected = ["Daif", "Very Daif", "Mawdu", "Munkar", "Shadh", "Daif Isnaad", "Sahih Isnaad", "Isnaad Sahih", "Isnaad Hasan",
    "Hasan Isnaad", "Mauquf Sahih", "Maqtu Sahih", "Sahih Muquf", "Sahih Maqtu", "Sahih Isnaad Maqtu", "Hasan Sahih Isnaad",
    "-", "", null, undefined, "Sahih but weak chain", "Mursal Sahih", "Sanad Daif", "Something Else"];
  for (const raw of rejected) assert.equal(classifyGrade(raw), null, String(raw));
});

test("decideGrade: Bukhari/Muslim collection-level Sahih; others need unanimous Sahih/Hasan; lowest grade wins", () => {
  assert.equal(decideGrade(C("bukhari"), undefined).decision.grade, "Sahih");
  assert.equal(decideGrade(C("muslim"), []).ok, true);
  const g = (...a) => a.map(([name, grade]) => ({ name, grade }));
  const all = decideGrade(C("tirmidhi"), g(["Al-Albani", "Sahih"], ["Zubair Ali Zai", "Sahih - Agreed Upon"]));
  assert.equal(all.decision.grade, "Sahih");
  assert.match(all.decision.gradeSources, /Al-Albani: Sahih/);
  assert.equal(decideGrade(C("tirmidhi"), g(["A", "Sahih"], ["B", "Hasan Sahih"])).decision.grade, "Hasan");
  assert.deepEqual(decideGrade(C("abudawud"), g(["A", "Sahih"], ["B", "Daif"])), { ok: false, reason: "not_all_graders_authentic" });
  assert.deepEqual(decideGrade(C("abudawud"), g(["A", "Sahih"], ["B", "Sahih Isnaad"])), { ok: false, reason: "not_all_graders_authentic" });
  assert.deepEqual(decideGrade(C("nasai"), g(["A", "Sahih"], ["B", "-"])), { ok: false, reason: "not_all_graders_authentic" });
  assert.deepEqual(decideGrade(C("nasai"), []), { ok: false, reason: "no_grades" });
  assert.deepEqual(decideGrade(C("malik"), undefined), { ok: false, reason: "no_grades" });
});

test("splitNarrator: strips common English lead-ins, never invents or drops other content", () => {
  const a = splitNarrator("Narrated 'Aisha (the mother of the faithful believers):The commencement of the Divine Inspiration came.");
  assert.equal(a.narrator, "Narrated 'Aisha (the mother of the faithful believers)");
  assert.equal(a.matn, "The commencement of the Divine Inspiration came.");
  assert.equal(splitNarrator("It was narrated from Anas that:the Messenger of Allah (ﷺ) said: \"Seek knowledge.\"").narrator, "It was narrated from Anas that");
  assert.equal(splitNarrator("Abu Huraira reported:I went along with Allah's Messenger at a time.").narrator, "Abu Huraira reported");
  assert.equal(splitNarrator("Al-Fadl bin Al-`Abbas narrated that:Allah's Messenger said: \"As-Salat is two and two.\"").matn.startsWith("Allah's"), true);
  // no colon / not a lead-in / remainder too short -> unchanged
  const m = "Yahya related to me from Malik from Nafi that Abdullah ibn Umar divorced his wife.";
  assert.deepEqual(splitNarrator(m), { narrator: null, matn: m });
  assert.equal(splitNarrator("The Prophet said: be kind to people always and everywhere.").narrator, null);
  assert.equal(splitNarrator("Narrated X: short").narrator, null);
});

// Real Arabic, with diacritics (Bukhari 1577-style and a Muslim-style chain with the Prophet marker).
const AR_HONORIFIC = "حَدَّثَنَا عَبْدُ اللَّهِ بْنُ يُوسُفَ، قَالَ أَخْبَرَنَا مَالِكٌ، عَنْ هِشَامِ بْنِ عُرْوَةَ، عَنْ أَبِيهِ، عَنْ عَائِشَةَ ـ رضى الله عنها ـ أَنَّ النَّبِيَّ صلى الله عليه وسلم كَانَ يَفْعَلُ كَذَا وَكَذَا فِي الْمَسْجِدِ بَعْدَ صَلاَةِ الْعَصْرِ وَيَدْعُو اللَّهَ كَثِيرًا حَتَّى تَغِيبَ الشَّمْسُ وَيَنْصَرِفَ النَّاسُ إِلَى بُيُوتِهِمْ فِي سَلاَمٍ وَطُمَأْنِينَةٍ";
const AR_PROPHET = "حَدَّثَنَا قُتَيْبَةُ، عَنْ مَالِكٍ، عَنْ نَافِعٍ، عَنْ ابْنِ عُمَرَ، أَنَّ رَسُولَ اللَّهِ صلى الله عليه وسلم نَهَى عَنْ بَيْعِ الثَّمَرِ قَبْلَ أَنْ يَبْدُوَ صَلاَحُهَا نَهَى الْبَائِعَ وَالْمُبْتَاعَ وَقَالَ لاَ تَبِيعُوا الثَّمَرَ حَتَّى يَبْدُوَ صَلاَحُهُ فِي كُلِّ مَوْضِعٍ وَزَمَانٍ";

test("extractIsnadAr: cuts at a safe marker, result is an exact prefix, otherwise null", () => {
  const a = extractIsnadAr(AR_HONORIFIC);
  assert.ok(a && AR_HONORIFIC.startsWith(a));
  assert.ok(a.endsWith("رضى الله عنها"));
  const b = extractIsnadAr(AR_PROPHET);
  assert.ok(b && AR_PROPHET.startsWith(b) && b.endsWith("عَنْ ابْنِ عُمَرَ"));
  assert.equal(extractIsnadAr(null), null);
  assert.equal(extractIsnadAr("قَالَ رَسُولُ اللَّهِ صلى الله عليه وسلم إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى"), null, "no chain before the marker");
  // "كان رسول الله" must not be mistaken for "ان رسول الله" (word boundary)
  assert.equal(extractIsnadAr("كَانَ رَسُولُ اللَّهِ صلى الله عليه وسلم يُحِبُّ التَّيَمُّنَ فِي تَنَعُّلِهِ وَتَرَجُّلِهِ وَطُهُورِهِ"), null);
});

test("extractIsnadAr: a marker deep inside a long narrative is refused (no 'isnad' that is most of the text)", () => {
  const story = "حَدَّثَنَا أَحْمَدُ، عَنْ أَبِيهِ، عَنْ جَدِّهِ " + "وَذَهَبْنَا إِلَى الْمَدِينَةِ وَرَأَيْنَا النَّاسَ يَتَحَدَّثُونَ ".repeat(8) + "وَكَانَ ابْنُ عُمَرَ ـ رضى الله عنه ـ يَفْعَلُهُ دَائِمًا فِي كُلِّ وَقْتٍ";
  assert.equal(extractIsnadAr(story), null);
});

test("embedText: hadith = Book + Chapter + Matn only (no isnad, narrator, number or grade)", () => {
  const t = embedText({ sourceType: "hadith", bookName: "Sahih al-Bukhari", chapterTitle: "Revelation",
    textEn: "Narrated 'Umar bin Al-Khattab:I heard Allah's Messenger saying: \"The reward of deeds depends upon the intentions.\"" });
  assert.equal(t, "Sahih al-Bukhari. Revelation. I heard Allah's Messenger saying: \"The reward of deeds depends upon the intentions.\"");
  assert.ok(!/Narrated|Umar bin/.test(t));
  const noChapter = embedText({ sourceType: "hadith", bookName: "Muwatta Malik", chapterTitle: null, textEn: "Yahya related to me from Malik that the Prophet forbade it." });
  assert.ok(noChapter.startsWith("Muwatta Malik. Yahya related"));
});

test("embedText: Quran = Surah name + verse number + translation (+ topic when present)", () => {
  const base = { sourceType: "quran", surahName: "Al-Baqarah", surahNumber: 2, ayahNumber: 255, textEn: "Allah - there is no deity except Him." };
  assert.equal(embedText(base), "Surah Al-Baqarah 2:255. Allah - there is no deity except Him.");
  assert.equal(embedText({ ...base, topicSummary: "Allah's oneness and sovereignty" }),
    "Surah Al-Baqarah 2:255. Allah - there is no deity except Him. Topic: Allah's oneness and sovereignty");
});

test("embedText is capped and whitespace-normalised; contentHash is a stable uuid-shaped md5", () => {
  const long = embedText({ sourceType: "hadith", bookName: "B", chapterTitle: "C", textEn: "x ".repeat(10000) });
  assert.ok(long.length <= 6000);
  assert.match(contentHash("a"), /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  assert.equal(contentHash("a"), contentHash("a"));
  assert.notEqual(contentHash("a"), contentHash("b"));
  assert.equal(contentHash("hello"), "5d41402a-bc4b-2a76-b971-9d911017c592");
});

test("buildHadithRows: filters, text-ref for fractional numbers, chapter from sections, stats add up", () => {
  const eng = {
    metadata: { sections: { "1": "The Book of Purification" } },
    hadiths: [
      { hadithnumber: 1, text: "Narrated A:one two three four five six seven", grades: [{ name: "x", grade: "Sahih" }], reference: { book: 1, hadith: 1 } },
      { hadithnumber: 2, text: "", grades: [{ name: "x", grade: "Sahih" }], reference: { book: 1, hadith: 2 } },
      { hadithnumber: 3, text: "weak one", grades: [{ name: "x", grade: "Daif" }], reference: { book: 1, hadith: 3 } },
      { hadithnumber: 4, text: "ungraded one", reference: { book: 1, hadith: 4 } },
      { hadithnumber: "402.2", text: "fractional number hadith text", grades: [{ name: "x", grade: "Hasan" }, { name: "y", grade: "Sahih" }], reference: { book: 1, hadith: 5 } },
      { hadithnumber: 1, text: "duplicate ref", grades: [{ name: "x", grade: "Sahih" }], reference: { book: 1, hadith: 6 } },
    ],
  };
  const { rows, stats } = buildHadithRows(C("nasai"), eng, { hadiths: [{ hadithnumber: 1, text: "ar text" }] });
  assert.deepEqual(rows.map((r) => r.ref), ["1", "402.2"]);
  assert.equal(rows[0].chapterTitle, "The Book of Purification");
  assert.equal(rows[0].refLabel, "Sunan an-Nasa'i 1");
  assert.equal(rows[1].grade, "Hasan");
  assert.equal(rows[0].textAr, "ar text");
  assert.equal(rows[1].textAr, null);
  assert.equal(stats.total, 6);
  assert.equal(stats.accepted + stats.skippedEmptyEnglish + stats.skippedNoGrades + stats.skippedNotAllAuthentic + stats.skippedDuplicateRef, 6);
  assert.deepEqual([stats.skippedEmptyEnglish, stats.skippedNoGrades, stats.skippedNotAllAuthentic, stats.skippedDuplicateRef], [1, 1, 1, 1]);
});
