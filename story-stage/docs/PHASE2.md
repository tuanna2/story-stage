# Phase 2 — Hồ sơ trinh thám và tiết lộ có nguồn

Phase này thêm sự thật quá khứ cố định, manh mối có hai cách đọc, giả thuyết riêng của nhân vật và sổ thông tin độc giả. Mục tiêu là tạo điều kiện cho một chi tiết đổi nghĩa khi có chứng cứ mới, như cơ chế trong “Tần Phong – Vụ án người mù giết người”. Phần mềm không tái dựng kết cục của truyện mẫu và không bảo đảm ChatGPT sẽ tạo một truyện đạt chất lượng tương đương.

## Dùng ngay

1. Mở **http://127.0.0.1:4317**, chọn **Dàn dựng truyện mới**. Preset mặc định mới là **Hồ sơ dưới cơn mưa**: 4 nhân vật, 6 manh mối, 4 câu hỏi, đề xuất tối đa 8 cảnh.
2. Có thể sửa `casefile` và các `world.facts` liên kết trong JSON dàn dựng trước prompt đầu tiên. Hồ sơ là quá khứ đã xảy ra, không phải chuỗi cảnh tương lai.
3. Trong **Hồ sơ vụ án**, mở phần sự thật nền nếu bạn muốn xem đáp án. Mỗi thẻ manh mối ghi điều kiện tiếp cận, cách hiểu bề mặt, cách đọc lại, người đã phát hiện và trích đoạn nguồn.
4. Mô phỏng và viết văn xuôi theo luồng copy prompt → ChatGPT → paste JSON → xem trước → nhập. Không cần API.
5. **Góc nhìn độc giả** chỉ cập nhật sau khi nhập bản thảo Người kể. Một nhân vật biết đáp án chưa có nghĩa độc giả đã biết. Sổ này lưu trích đoạn thực sự xuất hiện trong văn xuôi, không gửi toàn bộ đáp án nền.

Truyện tùy chỉnh chưa có hồ sơ: vào **Hồ sơ vụ án → Tạo hồ sơ bằng ChatGPT** trước lượt mô phỏng đầu tiên. Dán và duyệt câu trả lời `case_setup` để tạo hồ sơ một lần. Các truyện cũ vẫn dùng được; không tự gán đáp án mới vào diễn biến đã có. Không chuẩn bị hồ sơ khi đang có một prompt/hành động chờ xử lý.

## Lớp thông tin

| Lớp | Dữ liệu | Ai nhận |
| --- | --- | --- |
| Quá khứ cố định | `casefile`, `world.facts`, timeline và liên kết chứng cứ | World, người dàn dựng |
| Dấu vết đã biết | `case_ledger.discoveries`, facts có `known_by` | Nhân vật đã chứng kiến/được chia sẻ |
| Cách hiểu riêng | `case_ledger.interpretations`, `beliefs` | Chính nhân vật; Narrator của POV đó |
| Đã được kể | `reader.facts/clues/interpretations/answers` | Sổ độc giả và Narrator |

Trong mode **gộp**, toàn bộ packet vẫn nằm trong một phiên ChatGPT; ranh giới vai trò dựa trên chỉ dẫn. Mode **tách** không gửi hồ sơ ẩn của World hoặc đáp án người khác vào prompt nhân vật. Dùng hội thoại riêng cho mỗi nhân vật, World và Người kể; mở hội thoại Người kể mới khi đổi POV.

Narrator có log POV chứng kiến, manh mối và giả thuyết của POV, các fact được phép kể và sổ độc giả; không có toàn bộ timeline, điều kiện phát hiện hoặc `deeper_reading`. Với truyện có hồ sơ, prompt Narrator cũng bỏ nền/bí mật riêng và các fact tự sinh `secret_<id>` khỏi profile để giảm việc kể đáp án chưa được chuẩn bị. Nội tâm và đối thoại trong log vẫn cần biên tập về ngữ nghĩa.

## Hợp đồng bổ sung

`casefile` liên kết ID của facts tồn tại:

```text
central_question
truths[]: fact_id, required_clue_ids[]
timeline[]: id, at, text, fact_ids[]
clues[]: id, title, evidence_fact_id, location, discovery_condition,
         surface_reading, deeper_reading, truth_fact_ids[]
questions[]: id, text, answer_fact_ids[], required_clue_ids[]
```

`evidence_fact_id` chỉ mô tả dấu vết, phải tách khỏi fact đáp án. Fact nền có thể dùng `claim:{key,value}` cho khẳng định lịch sử quan trọng. Một fact mới dù ID khác cũng bị từ chối nếu dùng cùng `claim.key` với giá trị khác.

Mỗi turn và world event có thể thêm:

```json
{
  "clue_discoveries": [
    {"clue_id": "c-copy", "by": ["quan"], "excerpt": "Dòng nhân chứng trống không."}
  ]
}
```

`by` phải thuộc witnesses; excerpt phải có trong outcome (hoặc text của world event). Phần mềm mở fact dấu vết cho người nhận, lưu scene/turn và nguồn hành động/sự kiện. Muốn chia sẻ dấu vết cho người khác, ghi một discovery mới có nguồn, không dùng `reveals` để bỏ qua ledger.

Giả thuyết của actor:

```json
{
  "interpretation_updates": [
    {"clue_id": "c-copy", "text": "Có thể tôi ghi thiếu lời khai.", "confidence": 65}
  ]
}
```

Actor phải biết manh mối trước lượt. Điều vừa phát hiện chỉ được diễn giải từ lượt sau. Giả thuyết có thể sai, không thay đổi facts. Ở mode tách, World giữ giả thuyết của Character đã chọn, không viết thay.

Tiết lộ fact đáp án:

```json
{
  "fact_id": "f-report",
  "to": ["quan"],
  "evidence_clue_ids": ["c-copy", "c-original", "c-log"],
  "source_character_id": null,
  "excerpt": "Lam đã xóa dòng nhân chứng sau khi Quân nộp."
}
```

Có hai nguồn hợp lệ: người nhận biết tất cả chứng cứ bắt buộc; hoặc `source_character_id` là người có mặt và đã biết fact, thực sự nói ra theo outcome. Lời thú nhận có thể mở quyền biết trước khi chuỗi chứng cứ hoàn tất, nhưng câu hỏi trong sổ độc giả vẫn cần đủ fact và clue để ghi đã có đáp án.

Narration có thêm hai trường trong **cùng câu trả lời**:

```json
{
  "reader_updates": {"facts": [], "clues": [], "interpretations": [], "answers": []},
  "editorial_check": {
    "pov_consistent": true,
    "no_new_events": true,
    "ground_truth_consistent": true,
    "clues_supported": true,
    "notes": []
  }
}
```

Các entry của reader đều có excerpt trích từ prose. Facts phải POV biết và đáp án được chuẩn bị bằng manh mối đã kể hoặc thú nhận có nguồn; clue phải POV biết; interpretation phải khớp một giả thuyết riêng đã lưu; answer phải đủ các facts và clues liên kết. Reader lưu lần xuất hiện đầu của fact/clue/answer và lịch sử thay đổi interpretation.

`editorial_check` là **tự đánh giá của LLM**, không phải một agent độc lập đã chạy. Nếu một cờ false, nhập bị chặn để sửa bản thảo. ID, nguồn và trích đoạn được code kiểm tra; code không chứng minh một trích đoạn có ý nghĩa khớp hoàn toàn với fact, không tìm được mọi chi tiết văn xuôi bịa thêm hoặc bỏ sót khỏi `reader_updates`. Người dùng vẫn cần đọc phần xem trước.

## Số thao tác và nhịp truyện

Preset có hồ sơ không thêm lượt trao đổi. Chuẩn bị hồ sơ tùy chỉnh thêm **1 lần ở đầu truyện**. Tự kiểm tra và sổ độc giả nằm trong prompt Người kể hiện có. Với 6 lượt/cảnh, gộp 3 lượt: tối đa 2 prompt mô phỏng + 1 prompt Người kể; gộp 6 lượt: 1 + 1.

Nhịp truyện được tính bằng code: câu hỏi chưa trả lời, manh mối chưa phát hiện, cảnh còn lại, số cảnh chưa có thông tin mới cho độc giả. Sau hai cảnh chững, prompt World gợi ý cơ hội tiếp cận dấu vết; không tự trao đáp án, tạo cái chết hoặc ép nhân vật thú nhận. Đạt giới hạn cảnh vẫn hoàn tất dù câu hỏi còn mở.

## Lưu trữ và nâng cấp

Các trường mới nằm trong aggregate JSON của `projects`, cùng transaction với job và audit. `db/002_case_setup.sql` bổ sung loại job; `schema_migrations` ghi migration đã chạy. Khởi động tự chạy các migration còn thiếu, khóa migration theo database để tránh chạy đồng thời.

Đọc project cũ chỉ bổ sung các container rỗng `casefile:null`, `reader`, `case_ledger`; không thay lịch sử hoặc tự tạo hồ sơ. Preset xuất ra giữ casefile và kiến thức hiện tại, nhưng truyện mới bắt đầu với reader rỗng. Export toàn bộ JSON giữ ledger và reader gốc.

Endpoints bổ sung:

- `POST /api/projects/:id/case/jobs` với `{guidance}`: tạo prompt chuẩn bị hồ sơ.
- `GET /api/projects/:id/reader`: câu hỏi công khai, trích đoạn đã kể và trạng thái đáp án; không trả timeline, điều kiện khám phá, deeper reading hoặc đáp án chưa kể.

Đây vẫn là ứng dụng biên tập cá nhân local; màn hình độc giả là một chế độ xem, không phải hệ thống phân quyền xuất bản nhiều người dùng.

## Kiểm thử và minh họa

```bash
npm run check
npm test
npm run test:mysql
TEST_MYSQL=1 node --env-file=.env --test test/*.test.js
npm run example:case
```

Đã qua 47 kiểm thử trên MariaDB Docker của người dùng và MySQL 8.4: đồ thị hồ sơ, tiết lộ có nguồn, giả thuyết riêng, nguồn world event, rollback, reader sau narration, import/export, sáu cảnh đổi POV/cách hiểu, HTTP commit đồng thời, audit đúng một lần và mở store mới. Các project kiểm thử được dọn theo ID riêng, không xóa dữ liệu người dùng.

`examples/case-fixture.js` chứa chuỗi sáu cảnh **viết sẵn**. Lệnh example tạo `examples/output/case-story.md` và `case-log.json`; đây là acceptance fixture cho cơ chế, không phải chất lượng truyện đã đo trên ChatGPT. Preset dùng thật không nhận chuỗi cảnh này và không bị buộc đi theo nó.
