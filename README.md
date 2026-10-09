# Story Stage

Ứng dụng Node.js + Fastify + MySQL để mô phỏng truyện từ các nhân vật có động cơ, cảm xúc và ký ức riêng. Trao đổi với ChatGPT bằng sao chép prompt và dán JSON, không cần API key.

Mã nguồn nằm trong [`story-stage/`](story-stage/). Phase 2 bổ sung hồ sơ vụ án cố định, manh mối có nguồn, giả thuyết riêng và thông tin đã kể cho độc giả.

## Chạy local

```bash
cd story-stage
npm ci
cp .env.example .env
docker compose up -d
```

Chờ MySQL báo `healthy` trong `docker compose ps`, rồi chạy:

```bash
npm start
```

Mở **http://127.0.0.1:4317**. Cần Node.js 22+ và Docker. Có thể dùng database có sẵn bằng cách sửa `.env`.

## Hướng dẫn

- [Cài đặt và cách viết truyện](story-stage/README.md)
- [Phase 2: hồ sơ trinh thám và tiết lộ có nguồn](story-stage/docs/PHASE2.md)
- [Kiến trúc và hợp đồng dữ liệu](story-stage/docs/ARCHITECTURE.md)
- [Minh họa sáu cảnh viết sẵn để kiểm tra luồng](story-stage/examples/output/case-story.md)

`.env`, dữ liệu runtime và thư viện cài đặt được bỏ qua bởi Git. Các mật khẩu trong cấu hình mẫu là giá trị phát triển local.
