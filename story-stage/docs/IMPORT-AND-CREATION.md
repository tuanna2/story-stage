# Nhập output và tạo truyện riêng

## Luồng nhập

`readLLMJSON` nhận văn bản tối đa 1 MB, tách một container JSON hoàn chỉnh khỏi Markdown/lời dẫn, đọc lớp bọc phổ biến, rồi sửa cú pháp bằng [jsonrepair](https://github.com/josdejong/jsonrepair). Không dùng `eval`. Không ghép nhiều output, không thêm phần kết bị cắt dở và không xóa dấu ba chấm dùng thay dữ liệu.

Nếu JSON chưa đọc được vì lời thoại dùng hai dấu gạch chéo trước dấu nháy, bộ nhập sửa về một dấu trong chuỗi khi dấu nháy đó không thể là dấu kết thúc chuỗi JSON. Ghi chú chuẩn hóa cho biết số dấu đã sửa. JSON hợp lệ được đọc trước và giữ nguyên, gồm các đường dẫn/backslash hợp lệ. Bản dán gốc vẫn lưu nguyên trong log; đọc lại văn xuôi chuẩn hóa trước khi nhập.

`importResponse` chuẩn hóa những khác biệt có thể xác định từ dữ liệu đã có:

- Bổ sung metadata **chưa có** từ job đang chờ; không ghi đè metadata sai được trả rõ ràng.
- Đổi tên nhân vật khớp duy nhất sang ID; tên trùng cần dùng ID.
- Chuyển chuỗi số hợp lệ sang số; không ép thang giá trị hoặc sửa số ngoài giới hạn.
- Đổi một số tên khóa rõ nghĩa (`private_thought`, `public_action`, `emotions`, `scene_update`, `narrative`, `story_text`); hai khóa mâu thuẫn bị chặn.
- Danh sách cập nhật vắng mặt dùng `[]`, world_event vắng mặt dùng `null`; địa điểm/thời gian/áp lực vắng mặt giữ trạng thái hiện tại.
- Narration thiếu POV/lượt nguồn lấy từ cảnh đã mô phỏng. Chỉ truyện không có hồ sơ nhận văn xuôi thuần; tóm tắt là trích đoạn đầu, không thêm một lần gọi LLM.

Sau đó Zod và engine kiểm tra toàn bộ hợp đồng: phiên bản prompt, trạng thái nhân vật, phạm vi chứng kiến, niềm tin có nguồn, sự thật bất biến, phát hiện và tiết lộ có chứng cứ, POV, sổ độc giả. Không tự tạo thought/intention/action/outcome/witnesses hoặc tự xác nhận editorial_check. Vụ án vẫn phải có reader_updates đầy đủ và tự kiểm tra của Người kể.

Preview chạy trên bản sao và trả `normalized_response` cùng `import_notes`; không ghi DB. Commit lặp lại cùng pipeline trong transaction, lưu bản dán gốc, dữ liệu hợp lệ và ghi chú vào aggregate; audit giữ dữ liệu đã chuẩn hóa. UI xóa preview sau khi sửa ô dán để buộc duyệt lại.

## Tạo dự án mới

Có ba cách dàn dựng, không giới hạn thể loại bằng enum:

1. **Tự dàn dựng:** nhập form thế giới, quy tắc, style và 2–8 hồ sơ. `POST /api/projects` nhận `{custom, config}`; builder tạo ID `char_1…char_8`, cảm xúc khởi đầu trung tính, chưa có niềm tin/quan hệ mới và chưa có hồ sơ vụ án. Bí mật trở thành fact riêng trong engine.
2. **Nhờ ChatGPT:** `POST /api/setup/prompt` nhận `{name, genre, idea, constraints?, voice?, words?, character_count?}`, trả prompt cùng mẫu đầy đủ. Người dùng copy/paste; không gọi API LLM. `POST /api/setup/preview` nhận `{raw}`, kiểm tra preset và tham chiếu mà chưa tạo dự án. Sau khi duyệt, dùng `POST /api/projects` với `{preset, config}`.
3. **Dùng preset:** giữ các mẫu và chỉnh JSON nâng cao. Các preset chỉ là điểm bắt đầu.

Ý tưởng, nhân vật và cấu hình được giữ khi đổi tab trong cùng cửa sổ dàn dựng. Truyện đã tạo có ID riêng và lưu bền vững bằng store hiện tại. Không cần migration DB. Thư viện không còn cắt danh sách ở tám dự án; danh sách và sidebar cuộn khi cần.

Nếu truyện mới cần hồ sơ bí ẩn, dùng **Hồ sơ vụ án → Tạo hồ sơ bằng ChatGPT** trước prompt mô phỏng đầu tiên. Hồ sơ xác định quá khứ; hành động và tương lai tiếp tục để mở.

## Kiểm chứng

Các regression test kiểm tra định dạng dán phổ biến, dấu nháy lời thoại escape hai lần, giữ backslash hợp lệ, rollback khi metadata/knowledge sai, tên trùng, không sửa output cắt dở, narration, bắt buộc chứng cứ vụ án, tạo nhiều thể loại, preview dàn dựng không ghi store, commit và mở lại store. Chạy cùng suite trên FileStore, MySQL 8.4 và MariaDB của người dùng. Browser QA ban đầu dùng fixture viết sẵn; bản narration thực tế người dùng gửi sau đó đã được kiểm tra bằng chính parser và preview với prompt đang chờ, không commit vào truyện.
