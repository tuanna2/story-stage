# AI Agent viết hết truyện

Skill [story-stage-writer](../../.agents/skills/story-stage-writer/SKILL.md) cho Agent có quyền đọc/ghi file và chạy lệnh tự viết các cảnh còn lại và lưu vào DB. Agent đang dùng tự tạo nội dung; CLI chỉ gọi Fastify local, không gọi API mô hình hay yêu cầu API key.

## Cách dùng

1. Chạy web và MySQL như README. Mở dự án muốn viết tiếp.
2. Trên **Sân khấu**, chọn **Viết hết bằng AI Agent → Sao chép yêu cầu cho Agent**.
3. Gửi yêu cầu đó vào Codex/Agent đang làm việc trong thư mục repo trên máy truy cập được web. Yêu cầu có project ID, đường dẫn skill và CLI, cùng quyền lưu đến hết truyện.
4. Agent tự lấy job → viết output → kiểm tra/lưu → lấy job tiếp. Khi hết cảnh, tự viết văn xuôi và tiếp tục cảnh kế, đến trạng thái `complete`. Tiến độ, ký ức, sự kiện và phiên bản bản thảo lưu sau từng bước hợp lệ.
5. Trong web, **Cập nhật tiến độ** hoặc tải lại trang để đọc trạng thái từ DB. Bản thảo xuất ra Markdown và JSON khi Agent hoàn thành.

Web không tự khởi chạy phiên Agent; đóng hoặc dừng phiên Agent thì phần viết không tiếp tục trong nền. DB giữ checkpoint sau mỗi job. Khi chạy lại, dùng cùng yêu cầu/project ID để tiếp tục. Giữ web và DB hoạt động trong lúc viết; chỉ mở trang web chưa đủ để sinh nội dung.

Codex hỗ trợ skill trong `.agents/skills` từ thư mục làm việc đến root repo; xem [tài liệu skill chính thức](https://learn.chatgpt.com/docs/build-skills). Task có đường dẫn `SKILL.md` để Agent vẫn đọc được nếu skill chưa xuất hiện trong danh sách.

## CLI

Chạy từ `story-stage` với Node.js 22+. Có thể dùng đường dẫn tuyệt đối tới script từ thư mục khác. Các giá trị PROJECT_ID, JOB_ID là ID thật trong DB.

```bash
node scripts/agent-story.js projects
node scripts/agent-story.js status PROJECT_ID
node scripts/agent-story.js next PROJECT_ID --out artifacts/agent/PROJECT_ID/job.json
node scripts/agent-story.js submit PROJECT_ID JOB_ID --file artifacts/agent/PROJECT_ID/JOB_ID.json
node scripts/agent-story.js export PROJECT_ID --out artifacts/agent/PROJECT_ID/story.md
node scripts/agent-story.js export PROJECT_ID --out artifacts/agent/PROJECT_ID/story.json --format json
```

Mặc định web `http://127.0.0.1:4317`; biến `STORY_STAGE_URL` đổi địa chỉ gốc/port local. CLI từ chối host ngoài local và redirect. Nó không đọc `.env` hay cần mật khẩu DB. Không chỉnh SQL hoặc aggregate thủ công.

`next --out` ghi toàn bộ prompt vào file; stdout chỉ in metadata và đường dẫn để tránh cắt mất prompt dài. Agent phải đọc toàn bộ file. `next` giữ nguyên job đang chờ, kể cả job người dùng đã tạo qua ChatGPT; không ghi đè hay hủy job. Bản dán chưa nhập trong trình duyệt không tự gửi cho Agent; nếu muốn dùng bản đó, nhập trước hoặc cung cấp file cho Agent.

`submit` trả JSON tiến độ, job đã nhận, ghi chú chuẩn hóa/độ dài. Validation và cập nhật chạy trong cùng transaction; dữ liệu lỗi không lưu, CLI thoát mã khác 0 và in lỗi/đường dẫn trường ở stderr. Skill sửa output tối đa hai lần rồi dừng nếu vẫn lỗi; không bỏ qua bước hay đổi người biết để vượt kiểm tra.

Gửi lại **cùng bản raw** cho job đã nhập trả `reused:true`, không tăng revision hoặc tạo thêm audit, kể cả khi truyện đã tiến thêm. Raw khác cho job đó bị từ chối 409. Các endpoint thủ công giữ quy tắc chỉ nhập một lần hiện có. Job biên tập `rewrite` dùng luồng riêng và không thể nhập qua Agent submit.

## Endpoint

| Method | Endpoint | Kết quả |
| --- | --- | --- |
| GET | `/api/projects/:id/agent/status` | Tiến độ, job đang chờ, loại bước kế; không lộ nội dung bí mật |
| GET | `/api/projects/:id/agent/task` | Yêu cầu giao việc có project ID và đường dẫn; không thay đổi dự án |
| POST | `/api/projects/:id/agent/next` | Body `{}`; cấp/giữ job hoặc trả `complete:true, job:null` |
| POST | `/api/projects/:id/agent/jobs/:job/submit` | Body `{raw}`; kiểm tra và lưu nguyên tử, có retry an toàn |

Agent dùng số cảnh/lượt và mục tiêu độ dài đã cấu hình; không tự giảm số cảnh để kết thúc. Kết thúc có thể còn câu hỏi mở nếu phù hợp diễn biến. Prompt giới hạn người biết và POV; code kiểm tra cấu trúc, ID, nguồn và phiên bản, còn chất lượng văn xuôi/ý nghĩa tiết lộ cần đọc đánh giá. Một phiên Agent ở cả chế độ gộp và tách vai không tương đương nhiều mô hình có ngữ cảnh cách ly.
