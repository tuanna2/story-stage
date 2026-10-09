# Story Stage

Web **Node.js + Fastify + MySQL** để dàn dựng truyện bằng tương tác của nhân vật. Trao đổi với ChatGPT bằng **sao chép prompt / dán JSON**, không gọi API, không cần API key.

Đã đọc hai văn bản gốc trong thư mục cha và tạo hai tình huống mở dựa trên cơ chế kể chuyện của chúng. Đọc [phân tích hai mẫu](docs/STORY-ANALYSIS.md) và [kiến trúc, hợp đồng dữ liệu](docs/ARCHITECTURE.md).

**Phase 2 đã có:** preset **Hồ sơ dưới cơn mưa**, hồ sơ quá khứ cố định, sổ manh mối có nguồn, cách hiểu riêng và thông tin đã kể cho độc giả. Xem [hướng dẫn phase 2](docs/PHASE2.md). Chọn **Dàn dựng truyện mới** để bắt đầu; hồ sơ mẫu đã sẵn sàng, không thêm lần copy/paste cho mỗi cảnh.

## Mở ứng dụng

Địa chỉ: **http://127.0.0.1:4317**.

Máy hiện tại đã có MySQL 8.4 trong Docker, schema, `.env` và thư viện cần thiết. Nếu tiến trình web đã dừng:

```bash
cd /Users/tommy/Desktop/skill/story-stage
docker compose up -d
npm start
```

Để cài ở máy khác, cần Node.js 22+ và Docker:

```bash
npm ci
cp .env.example .env
docker compose up -d
npm run db:migrate
npm start
```

Chờ MySQL báo `healthy` trong `docker compose ps` trước khi migrate/start. MySQL Docker lắng nghe ở `127.0.0.1:3307`; đổi `.env` nếu dùng MySQL có sẵn. Schema tự khởi tạo khi web chạy, nên lệnh migrate chỉ để kiểm tra riêng. Các mật khẩu trong compose là giá trị phát triển local.

Thử giao diện khi không có MySQL:

```bash
npm run demo
```

Chế độ thử lưu vào `.data/projects.json`. Đây là lựa chọn rõ ràng, không tự động thay MySQL khi kết nối lỗi. Dữ liệu của hai chế độ tách biệt. Chế độ file chỉ dùng một tiến trình web.

## Viết truyện

1. Chọn **Dàn dựng truyện mới**. Tab **Tự dàn dựng** có form nhập ý tưởng, thể loại bất kỳ, bối cảnh, quy tắc, giọng kể và 2–8 nhân vật với mục tiêu/bí mật riêng. Tab **Nhờ ChatGPT** tạo một prompt dàn dựng từ ý tưởng: copy sang ChatGPT, paste output, kiểm tra và duyệt trước khi mở sân khấu. Tab **Dùng preset** vẫn có các tình huống mẫu và phần sửa JSON nâng cao. Mỗi lần tạo lưu thành dự án riêng; thư viện hiển thị toàn bộ dự án.
2. Trên **Sân khấu**, chọn **Tạo prompt tiếp theo**. Có thể vào **Trao đổi ChatGPT** trước để viết một chỉ dẫn ngắn cho lượt này.
3. **Sao chép prompt**, mở ChatGPT và gửi prompt. Web không gửi dữ liệu hay câu hỏi thay bạn.
4. Dán toàn bộ output vào **Câu trả lời nhận về**. Có thể kèm lời dẫn hoặc khối ` ```json `. Chọn **Kiểm tra & xem trước**. Web nhận một khối JSON hoàn chỉnh và chuẩn hóa các khác biệt định dạng phổ biến.
5. Đọc diễn biến, sự thật mới, cảm xúc và ghi chú chuẩn hóa. Mở **Xem JSON sẽ được lưu** để xem dữ liệu thực tế; chọn **Nhập kết quả & tiếp tục**. Nếu còn lỗi, dùng **Prompt sửa câu trả lời**: prompt này chứa mẫu gốc, bản dán và các trường cần sửa bằng tiếng Việt.
6. Cảnh kết thúc sớm theo kết quả của Thế giới hoặc đạt giới hạn lượt. Khi đó, tạo prompt **Người kể**, trao đổi cùng cách, rồi đọc cảnh trong **Bản thảo**.
7. Tiếp tục cảnh kế. Khi đạt giới hạn cảnh hoặc không còn nhân vật có thể hành động, mô phỏng hoàn tất. **Xuất truyện** tải bản thảo Markdown, toàn bộ log JSON hoặc preset từ trạng thái hiện tại.

Prompt đang chờ lưu trong MySQL. Bản JSON chưa nhập lưu ở trình duyệt hiện tại. Tải lại trang sẽ về Sân khấu; **Mở prompt đang chờ** để tìm lại bản dán. JSON sai không thay đổi trạng thái. Một prompt chỉ nhận một câu trả lời thành công.

Các trường hợp nhận được: JSON bọc trong `response`/`result`/`output`/`data`, mảng chứa một output, nháy đơn/nháy cong, dấu phẩy cuối và một số lỗi xuống dòng. Metadata thiếu lấy từ prompt đang chờ; tên nhân vật chỉ đổi sang ID khi khớp duy nhất. Số ở dạng chuỗi chuyển sang số rồi vẫn kiểm tra giới hạn. Danh sách không có cập nhật được để trống. Ghi chú chuẩn hóa và bản dán gốc được lưu trong log.

Web không tự dựng hành động, kết quả, người chứng kiến, bằng chứng hay phần câu trả lời bị cắt dở. ID/revision/kind đã ghi rõ nhưng sai vẫn bị chặn. Nếu có nhiều output hoặc dùng dấu ba chấm để lược bỏ dữ liệu, chỉ dán một output đầy đủ. Ở bước Người kể của truyện không có hồ sơ, có thể dán văn xuôi thuần: POV và lượt nguồn lấy từ cảnh đã mô phỏng; tóm tắt biên tập là trích đoạn đầu. Truyện có hồ sơ vẫn cần `reader_updates` và `editorial_check` thật để kiểm tra tiết lộ. Chi tiết triển khai: [docs/IMPORT-AND-CREATION.md](docs/IMPORT-AND-CREATION.md).

## Chọn cách trao đổi

Với **6 lượt/cảnh**:

| Chế độ | Cách dùng | Tối đa lần trao đổi/cảnh |
| --- | --- | ---: |
| Gộp 3 lượt, mặc định | Một prompt chạy tuần tự 3 lượt, cuối cảnh có prompt Người kể | 3 |
| Gộp 6 lượt | Một prompt mô phỏng cả cảnh, một prompt Người kể | 2 |
| Tách nhân vật | Một prompt nhân vật + một prompt Thế giới mỗi lượt, một prompt Người kể | 13 |

Cảnh kết thúc sớm sẽ cần ít trao đổi hơn. Việc sửa JSON có thể phát sinh thêm một lần. Số từ và kích thước prompt vẫn phụ thuộc hồ sơ, ký ức và số sự kiện.

**Gộp lượt** có các hồ sơ và bộ nhớ tách biệt trong ứng dụng, nhưng một phiên LLM nhìn thấy toàn bộ dữ liệu. Nó giữ ranh giới hiểu biết bằng chỉ dẫn; đây không phải cách ly ngữ cảnh thực sự.

**Tách nhân vật** chỉ đưa dữ liệu riêng của người đang hành động vào prompt. Dùng một cuộc trò chuyện ChatGPT riêng cho mỗi nhân vật; một cuộc khác cho Thế giới. Với Người kể, dùng cuộc mới khi đổi POV, để lịch sử trước không chứa nội tâm của POV cũ. Các prompt có đủ trạng thái để mở cuộc trò chuyện mới khi cần.

WorldAgent chọn actor trong cùng packet và có thể đề xuất người hành động tiếp. Web dùng vòng dự phòng khi không có đề xuất, lọc/truy xuất ký ức, kiểm tra và lưu dữ liệu, tóm tắt từng người chứng kiến. Các bước này không cần gửi thêm câu hỏi. LLM quyết định hành động, kết quả và cách diễn đạt; vòng trao đổi cần thao tác của bạn, nên chưa chạy tự động khi không có người dùng.

## Những màn hình đã có

- **Sân khấu:** timeline hành động → kết quả, sự kiện thế giới, nội tâm riêng, chọn cảnh cũ.
- **Trao đổi ChatGPT:** prompt, bản dán, kiểm tra cấu trúc/ID/người biết, xem trước, nhập một lần, hủy prompt, prompt sửa lỗi.
- **Dàn nhân vật:** tính cách, động cơ, cảm xúc 0–100, quan hệ tin tưởng −100…100, nền, giới hạn, niềm tin và dòng ký ức.
- **Thế giới:** luật và sổ sự thật cùng danh sách người biết từng sự thật.
- **Hồ sơ vụ án:** sự thật nền, timeline, manh mối bề mặt/đọc lại, điều kiện tiếp cận, nguồn phát hiện và giả thuyết riêng.
- **Góc nhìn độc giả:** trích đoạn manh mối/sự thật đã xuất hiện trong bản thảo, câu hỏi mở và đáp án có đủ chứng cứ.
- **Bản thảo:** văn xuôi từng cảnh và POV.
- **Lịch sử prompt:** xem lại nguyên prompt và JSON đã nhập.
- **Từ hai truyện mẫu:** nhận xét về hai văn bản và nguồn nghiên cứu.

Giao diện tiếng Việt, dùng được trên desktop và điện thoại. Không phụ thuộc dịch vụ font hoặc ảnh ngoài.

## Kiểm tra

```bash
npm run check
npm test
TEST_MYSQL=1 node --env-file=.env --test test/*.test.js
npm run test:mysql
npm audit
```

Test MySQL dùng đúng database cấu hình hiện tại, tạo fixture với ID riêng và chỉ xóa các fixture do test đó tạo. Test kiểm tra cách ly prompt, ranh giới sự thật/niềm tin, transaction, nhập đồng thời, restart, các chế độ mô phỏng, memory và export. Kiểm tra giao diện đã đi qua tạo truyện → JSON lỗi → JSON hợp lệ → preview → commit → Người kể → bản thảo bằng dữ liệu kiểm thử do người phát triển viết; không gửi câu hỏi tới ChatGPT trong lúc kiểm thử.

`npm run test:mysql` dùng cấu hình riêng trong `.env.test`, cần có file này để chạy. Trên máy hiện tại, file đã được cấu hình để kiểm tra bằng tài khoản root do bạn cung cấp trên container MariaDB tại `127.0.0.1:3306`, với database riêng `story_stage_test`. File chứa mật khẩu được bỏ qua bởi Git. Cấu hình ứng dụng `.env` dùng MySQL ở cổng 3307 được giữ nguyên.

## Phạm vi của bản này

Đây là phòng viết cá nhân chạy local, mặc định bind `127.0.0.1`. Chưa có tài khoản/đa người dùng hoặc triển khai lên hosting công khai. MySQL lưu trạng thái bền vững và audit, không phải một engine vật lý. Kiểm tra bằng code xác nhận cấu trúc, ID, phạm vi người chứng kiến, phiên bản và chuyển bước; tính hợp lý của hành vi, manh mối, tiết lộ và văn xuôi vẫn cần biên tập. Sự thật bất biến về ID/nội dung không có nghĩa chương trình hiểu và phát hiện được mọi mâu thuẫn ngữ nghĩa.

Để dừng web: Ctrl+C ở cửa sổ đang chạy `npm start`. Để dừng MySQL mà giữ dữ liệu: `docker compose stop`. Dữ liệu MySQL nằm trong Docker volume `story-stage-tommy_story_mysql`.
