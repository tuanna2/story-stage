# Phase 3: chất liệu, mạch truyện và biên tập

Phase này giúp viết cảnh dài từ tương tác cụ thể, theo dõi những việc còn dang dở và biên tập mà vẫn giữ nguồn mô phỏng. Tiếp tục dùng Fastify, MySQL và trao đổi ChatGPT bằng copy/paste. Các vai Nhân vật, Thế giới và Người kể vẫn dùng trạng thái và phạm vi biết riêng.

## Bắt đầu với truyện hiện có

1. Mở **Bản thảo → Độ dài & cách kể**.
2. Chọn khoảng 1.200–1.800 từ/cảnh, giọng kể phù hợp và gộp 6 lượt nếu muốn giảm thao tác. Truyện mới có mặc định 1.500 từ và gộp 6 lượt.
3. Lưu thiết lập. Prompt đang chờ vẫn dùng yêu cầu cũ; prompt được tạo tiếp sẽ nhận thiết lập mới.
4. Mô phỏng cảnh, đọc duyệt diễn biến rồi tạo prompt Người kể. Với 6 lượt/cảnh và gộp 6 lượt, thường cần hai lần trao đổi: mô phỏng và văn xuôi. Việc rà tính liên tục nằm trong câu trả lời Người kể.

Số từ là mục tiêu cho prompt, không phải điều kiện chặn nhập. Nếu nguồn ngắn hoặc thiếu hành động, Người kể cần ghi lưu ý và giữ nội dung có căn cứ. Web nhắc khi một lượt có dưới 80 từ chất liệu hoặc bản thảo dưới 65% mục tiêu. Bộ đếm dựa trên khoảng trắng, nên với tiếng Việt là chỉ số độ dài để so sánh, không phải phân tích từ vựng. Output bị cắt dở cần tạo lại đầy đủ; có thể giảm gộp xuống 3 lượt.

## Chất liệu từng lượt

Prompt mô phỏng yêu cầu khoảng 150–250 từ cho tổng `action` và `outcome` khi tình huống có đủ chất liệu:

- Lời thoại nguyên văn, việc nhân vật làm và chi tiết họ quan sát được.
- Phản ứng công khai của người có mặt, thay đổi trong tương tác.
- Hệ quả thực tế, có thể khác ý định của nhân vật.

Không bắt buộc mỗi lượt đều phát hiện manh mối, thêm sự thật hoặc mở mạch mới. Suy đoán vẫn là niềm tin; lời nói dối vẫn là lời nói. `thought` là nội tâm hư cấu ngắn của nhân vật. Nhân vật khác chỉ biết điều họ chứng kiến hoặc được tiết lộ đúng nguồn.

Schema nhận `action` tối đa 6.000 ký tự và `outcome` 8.000 ký tự. Câu trả lời cũ vẫn đọc được; các trường mới có thể vắng trong prompt đã tạo từ phiên bản trước.

## Mạch truyện

Trang **Mạch truyện** dành cho người dàn dựng, hiển thị mục tiêu, mâu thuẫn, lời hứa, nghi vấn và quan hệ. Mỗi mạch có trạng thái `open`, `resolved` hoặc `abandoned`, người tham gia, người biết và nguồn thay đổi.

Mục tiêu từ hồ sơ nhân vật được tạo thành mạch riêng, ban đầu chỉ chủ sở hữu biết. Thế giới có toàn bộ mạch để tạo cơ hội tương tác. Prompt một nhân vật chỉ nhận những mạch và trạng thái họ đã được biết: người vắng mặt không tự nhận cập nhật xảy ra sau đó.

Thế giới gửi `thread_updates` trong cùng kết quả mô phỏng/phân xử:

```json
{
  "thread_id": "promise_find_record",
  "kind": "promise",
  "title": "Kiểm tra hồ sơ vào sáng mai",
  "character_ids": ["phong", "quan"],
  "status": "open",
  "evidence_fact_ids": [],
  "excerpt": "Quân hẹn sẽ kiểm tra hồ sơ vào sáng mai."
}
```

Người hành động phải tham gia mạch; những người tham gia phải có mặt trong `witnesses`. Trích đoạn phải nằm trong hành động hoặc kết quả. Evidence phải là sự thật actor đã biết. Mạch mới bắt đầu ở `open`; cập nhật mạch cũ giữ ID, loại, tiêu đề và người tham gia. Giới hạn 200 mạch/dự án, tối đa 6 cập nhật/lượt. Thay đổi được xem trước và chỉ lưu khi nhập cả packet thành công.

Mạch bổ sung theo dõi tương tác. Đáp án vụ án vẫn được kiểm tra bởi hồ sơ, manh mối và sổ độc giả ở phase 2; đánh dấu một nghi vấn đã giải quyết không tự mở đáp án.

## Sửa và phiên bản

Trong **Bản thảo**, chọn cảnh rồi **Sửa văn xuôi**. Form có nội dung, tóm tắt biên tập và các trích đoạn nguồn nếu là vụ án. Có thể xem so sánh trước khi lưu. Người biên tập xác nhận đã giữ sự kiện, POV và nguồn tiết lộ.

Mỗi lần nhập Người kể, sửa trực tiếp, viết lại hoặc khôi phục tạo một phiên bản mới. Bản trước được giữ nguyên với thời gian, nguồn thao tác và dữ liệu kiểm tra. **Phiên bản & so sánh** hiển thị các đoạn giữ, bỏ và thêm giữa hai bản. Khôi phục cũng tạo phiên bản mới để lịch sử không bị mất.

Sửa văn xuôi giữ log sự kiện, thế giới, cảm xúc và ký ức mô phỏng. Tóm tắt biên tập là phần của bản thảo; ký ức đã được tạo từ nguồn mô phỏng tại lúc kết thúc cảnh vẫn giữ nguyên.

Với truyện có hồ sơ, bản sửa giữ cùng ID sự thật/manh mối/đáp án và cùng cách hiểu của độc giả. Trích đoạn mới phải xuất hiện trong văn xuôi. Sổ độc giả cập nhật câu chữ nguồn nhưng giữ số cảnh tiết lộ ban đầu. Muốn đổi sự kiện hay thời điểm tiết lộ, dùng nhánh trước cảnh.

Khi hai cửa sổ cùng sửa một cảnh, cửa sổ lưu sau nhận 409 nếu bản nguồn đã đổi. Mở lại bản mới trước khi tiếp tục biên tập.

## Viết lại qua ChatGPT

1. Chọn **Nhờ ChatGPT viết lại**, nhập yêu cầu như tăng nhịp đối thoại hoặc tiết chế phần giải thích.
2. Tạo prompt, copy sang ChatGPT rồi dán câu trả lời vào hộp viết lại.
3. **Kiểm tra bản viết lại**, đọc so sánh và JSON sẽ lưu.
4. **Nhập bản viết lại** để tạo phiên bản mới.

Prompt lấy ngữ cảnh Người kể tại thời điểm cảnh được mô phỏng, log POV đã chứng kiến và thông tin đã kể trong cảnh. Những đoạn ở cảnh trước là ngữ cảnh của độc giả; kiến thức riêng POV học ở cảnh sau không được gửi ngược vào prompt. Chỉ dùng lịch sử ChatGPT phù hợp với POV/nguồn này; một cuộc trò chuyện đã thấy đáp án tương lai vẫn có thể làm mô hình tiết lộ sớm.

Truyện thường nhận cả JSON và văn xuôi thuần. Vụ án cần JSON với `reader_updates` và `editorial_check`, giữ nguyên thông tin đã kể và đổi `excerpt` khớp bản mới. Khối Markdown/lời dẫn và lỗi cú pháp phổ biến được xử lý qua bộ nhập hiện có. Metadata rõ ràng nhưng sai vẫn bị chặn.

Mỗi dự án có tối đa một prompt viết lại đang chờ, độc lập với prompt mô phỏng. Bản dán được giữ trong trình duyệt, prompt trong database. Có thể tiếp tục mô phỏng trong khi chờ viết lại. Nếu bản thảo/chương/cách kể đổi sau khi tạo prompt viết lại, prompt cũ cần hủy và tạo lại. Nhập Người kể cho một cảnh khác cũng thay phiên bản bản thảo toàn dự án và làm prompt viết lại cũ hết hiệu lực.

`continuity_review` yêu cầu Người kể tự rà dòng thời gian, tính cách và phần lặp trong cùng câu trả lời. Các cờ được gửi là `false` sẽ chặn nhập. Trường này được để tùy chọn để nhận output cũ/văn xuôi thuần. Các cờ `true` là tự đánh giá của mô hình; code kiểm tra ID, nguồn, phiên bản và trích đoạn, còn ý nghĩa văn xuôi cần người viết đọc duyệt.

## Chương và nhánh

Mặc định hai cảnh đã viết thành một chương. **Chia chương** đổi số chương, tên và cảnh thuộc mỗi chương; mỗi cảnh thuộc đúng một chương và thứ tự cảnh được giữ. Markdown dùng bản đang được chọn của từng cảnh và tên chương hiện tại. JSON xuất toàn bộ lịch sử.

**Tạo nhánh trước cảnh** tạo dự án riêng từ mốc trước lượt đầu của cảnh được chọn. Nhánh giữ các cảnh trước đó, thế giới, ký ức, manh mối, người biết và mạch truyện tại mốc. Cảnh được chọn bắt đầu lại với 0 lượt; có thể mô phỏng lựa chọn khác. Dự án gốc tiếp tục giữ lịch sử hiện có. Thiết lập cách kể của nhánh lấy từ thiết lập hiện tại của dự án gốc.

Các cảnh được mô phỏng từ phase 3 có checkpoint trước cảnh. Cảnh cũ đã chạy nhưng thiếu checkpoint không thể khôi phục trạng thái lịch sử chính xác; nút tạo nhánh ở đó bị khóa. Cảnh mới chưa chạy trong dự án cũ có thể nhận checkpoint khi tạo prompt và dùng để tạo nhánh.

## Dữ liệu và HTTP

Aggregate bổ sung `threads`, `chapters`, `manuscript_revision`, `manuscript_events`, `pending_rewrite_job_id`. Cảnh có `versions`, `current_version_id`, `narrator_context`, `checkpoint`. Truyện cũ được nạp với một phiên bản `legacy` ổn định và nhóm chương mặc định; cấu hình đã lưu giữ nguyên.

`revision` điều khiển mô phỏng; `manuscript_revision` điều khiển biên tập. Job viết lại giữ `base_version_id` và `base_manuscript_revision`; nó đối chiếu metadata với job lúc tạo, nên mô phỏng có thể tiến thêm mà không làm sai envelope viết lại. Việc biên tập không tăng revision mô phỏng.

Migration [003_manuscript.sql](../db/003_manuscript.sql) thêm kind `rewrite` và bảng `manuscript_events`. Store cập nhật tất cả job đã đổi trong transaction, kể cả job mô phỏng nằm trước một job viết lại trong lịch sử. Các audit biên tập có unique `(project_id, revision)` và lưu nguyên tử cùng aggregate. Danh sách dự án sắp xếp trong Node để MySQL không filesort các payload JSON lớn.

| Method | Endpoint | Nội dung |
| --- | --- | --- |
| PATCH | `/api/projects/:id/writing` | `manuscript_revision`, `words`, `batch_size`, `voice`, `guidance` |
| PUT | `/api/projects/:id/chapters` | `manuscript_revision`, `chapters` |
| POST | `/api/projects/:id/scenes/:scene/versions` | `base_version_id`, `prose`, `summary`, `confirmed:true`, `reader_updates` nếu có hồ sơ |
| POST | `/api/projects/:id/scenes/:scene/restore` | `base_version_id`, `version_id` |
| POST | `/api/projects/:id/scenes/:scene/rewrite` | `base_version_id`, `guidance` |
| POST | `/api/projects/:id/scenes/:scene/fork` | `name` tùy chọn; trả dự án mới |

Viết lại dùng các endpoint job `preview`, `commit`, `cancel` hiện có. Preview chạy trên bản sao; commit kiểm tra và lưu một lần trong transaction. Mạch truyện được trả trong aggregate và cập nhật từ packet mô phỏng/phân xử.

## Kiểm chứng

Unit/API kiểm tra phiên bản bất biến, lưu đồng thời, job xen kẽ, rollback, mạch riêng/người vắng mặt, nguồn trích đoạn, ngữ cảnh lịch sử, chương, nhánh, export và mở lại store. Bộ file có 77 kiểm tra; MySQL 8.4 và MariaDB Docker có 78 kiểm tra.

Kiểm tra giao diện desktop và 390 × 844 dùng các dự án fixture riêng: sửa → so sánh → khôi phục → viết lại → tải lại → chia chương → đổi thiết lập → lọc mạch → tạo nhánh; thử lỗi trích đoạn vụ án rồi sửa và nhập JSON kèm Markdown. Các fixture đã xóa sau kiểm tra, payload hai dự án ban đầu được đối chiếu hash và giữ nguyên, bản dán đang chờ được giữ. Kiểm tra này dùng nội dung viết sẵn, chưa chứng minh ChatGPT sẽ luôn đạt độ dài hay chất lượng ngang hai truyện tham khảo.
