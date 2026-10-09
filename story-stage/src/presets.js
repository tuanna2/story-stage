import { createMysteryPreset } from './case-presets.js';
const mood = (fear, anger, hope, guilt) => ({ fear, anger, hope, guilt });
const character = (id, name, role, personality, background, goals, secret, limitations, emotions, color) => ({
  id, name, role, personality, background, goals, secret, limitations, mood: emotions, color,
  beliefs: [], trust: {}, memories: [], status: 'active',
});

export const presets = [
  {
    id: 'interrogation', name: 'Phòng thẩm vấn số 4', genre: 'Trinh thám tâm lý',
    description: 'Một lời tự thú bị bỏ qua. Bốn người theo đuổi bốn sự thật khác nhau.',
    source: 'Tham khảo cơ chế kể chuyện của “Tần Phong – Vụ án người mù giết người”. Đây là tình huống mở mới, không dựng lại kết thúc mẫu.',
    premise: 'Tần Phong, một người khiếm thị, đến tự thú trong khi cả đội đang tìm một người mất tích. Tề Quân được giao ghi lời khai. Đội trưởng Lâm Tước tin đây chỉ là một lời nhận tội giả. Bác Từ giữ chìa khóa kho hồ sơ cũ. Đồng hồ ngoài hành lang tiếp tục chạy.',
    world: {
      setting: 'Một đồn cảnh sát ở thành phố Nam Sơn, trong một tối mưa.',
      rules: ['Thế giới hiện thực; không có năng lực siêu nhiên.', 'Lời khai và suy đoán không tự động trở thành sự thật.', 'Mọi phát hiện cần một hành động, nhân chứng hoặc dấu vết cụ thể.', 'Nhân vật khiếm thị chỉ cảm nhận qua âm thanh, mùi, xúc giác và ký ức.', 'Không ép nhân vật đi đến kết thúc của truyện tham khảo.'],
      location: 'Phòng thẩm vấn số 4', time: '20:10', pressure: 48,
      facts: [
        { id: 'f-missing', text: 'Một người liên quan đến vụ án đang mất tích; đội điều tra chưa tìm được.', known_by: ['phong', 'quan', 'lam', 'tu'] },
        { id: 'f-arrival', text: 'Tần Phong vừa đến đồn và nói rằng mình có thông tin quan trọng.', known_by: ['phong', 'quan', 'lam', 'tu'] },
        { id: 'f-thu', text: 'Tiểu Thu là chú chó dẫn đường đã mất của Tần Phong, không phải một cô bé.', known_by: ['phong'] },
        { id: 'f-report', text: 'Một biên bản về Tiểu Thu từng bị bỏ khỏi hồ sơ. Tề Quân biết việc này.', known_by: ['quan'] },
        { id: 'f-athlete', text: 'Trước tai nạn, Tần Phong từng là vận động viên. Bác Từ còn nhớ tin tức này.', known_by: ['phong', 'tu'] },
      ],
    },
    characters: [
      character('phong', 'Tần Phong', 'Người đến tự thú', 'Kiên nhẫn, nhạy với sự coi thường; nói ngắn, đôi khi chua chát.', 'Mất thị lực sau một tai nạn. Tiểu Thu từng giúp anh tìm lại cuộc sống bình thường.', ['Buộc một người thực sự lắng nghe mình', 'Tìm câu trả lời về hồ sơ của Tiểu Thu'], 'Anh đang thử xem người hỏi cung có nhớ một cuộc gặp trong quá khứ hay không.', ['Không nhìn thấy; không thể mô tả màu sắc hay biểu cảm chưa được nói ra.'], mood(24, 73, 22, 36), '#9b8afb'),
      character('quan', 'Tề Quân', 'Cảnh sát ghi lời khai', 'Thông minh, phòng thủ khi bị nghi ngờ; muốn được công nhận.', 'Mới vào đội hình sự. Từng xử lý một phản ánh về Tiểu Thu nhưng không theo đuổi đến cùng.', ['Chứng minh năng lực trước đội trưởng', 'Giữ sai sót cũ không bị phơi bày'], 'Cô nhận ra tên Tiểu Thu nhưng chưa muốn thừa nhận.', [], mood(33, 20, 64, 58), '#efad77'),
      character('lam', 'Lâm Tước', 'Đội trưởng điều tra', 'Quyết đoán, đề cao chứng cứ, khó thay đổi nhận định ban đầu.', 'Đang chịu sức ép vì vụ mất tích. Tin rằng mình có thể lần ra mọi dấu vết.', ['Tìm người mất tích trước khi quá muộn', 'Giữ quyền kiểm soát cuộc điều tra'], 'Anh đã bỏ qua một cuộc gọi của Tề Quân và đang tự biện hộ cho lựa chọn ấy.', [], mood(26, 42, 55, 12), '#6ccfbd'),
      character('tu', 'Bác Từ', 'Người trông kho hồ sơ', 'Điềm đạm, ít nói; tránh rắc rối nhưng quý người chân thành.', 'Làm việc ở đồn đã lâu. Biết những hồ sơ nào vẫn còn trong kho giấy.', ['Kết thúc ca trực yên ổn', 'Giúp một người đang thật sự cần giúp'], 'Ông giữ một bản sao cũ trong ngăn tủ, chưa quyết định có nên đưa ra.', [], mood(18, 8, 47, 24), '#82b1f5'),
    ],
    style: { voice: 'Ngôi thứ nhất giới hạn, giọng kể căng thẳng và tiết chế.', guidance: 'Để đối thoại và chi tiết cảm giác mang thông tin. Phân biệt điều POV biết và điều POV đoán. Manh mối đổi nghĩa khi có chứng cứ mới; không tạo cú twist vô cớ.', words: 650 },
  },
  {
    id: 'escape', name: 'Đêm mưa sau hàng rào', genre: 'Sinh tồn · tâm lý',
    description: 'Một liên minh mong manh. Mỗi cơ hội đều có giá của nó.',
    source: 'Tham khảo “Việc trốn thoát khó đến mức nào”: cảm xúc thay đổi dưới áp lực và niềm tin giữa những người cùng cảnh ngộ.',
    premise: 'Trong một khu lao động bị kiểm soát, Tiểu Hoa nhận ra phục tùng không bảo đảm được tự do. Thiếu Hoàn muốn tìm đồng minh. Lý Tử vừa có được đặc quyền và phải cân nhắc cái giá của việc giúp người khác. Tài Gia muốn giữ trật tự trước một đợt kiểm tra. Một cơn mưa đang đến; chưa ai biết nó sẽ thay đổi điều gì.',
    world: {
      setting: 'Khu nhà ở và xưởng làm việc bị kiểm soát, sát bìa rừng, mùa mưa.',
      rules: ['Thế giới hiện thực, nguồn lực hữu hạn.', 'Người bị kiểm soát không biết toàn bộ lịch trình hay ý định của người quản lý.', 'Chấn thương, mệt mỏi và rủi ro có hậu quả kéo dài.', 'Đặc quyền là động cơ để thỏa hiệp, không phải bằng chứng được trả tự do.', 'Miêu tả hậu quả tâm lý; tiết chế chi tiết bạo lực.'],
      location: 'Hành lang khu nhà C', time: '21:30', pressure: 62,
      facts: [
        { id: 'f-rain', text: 'Mây dông đang kéo đến, chưa có mưa.', known_by: ['hoa', 'hoan', 'lytu', 'tai'] },
        { id: 'f-check', text: 'Có một đợt kiểm tra nội bộ vào sáng mai.', known_by: ['tai'] },
        { id: 'f-key', text: 'Lý Tử được phép vào phòng hồ sơ, nhưng quyền này có thể bị rút lại.', known_by: ['lytu', 'tai'] },
        { id: 'f-hoan', text: 'Thiếu Hoàn có thể nhận diện giọng của một người gác ca đêm.', known_by: ['hoan'] },
      ],
    },
    characters: [
      character('hoa', 'Tiểu Hoa', 'Người muốn về nhà', 'Bốc đồng nhưng đang học cách quan sát; thương người, dễ tự trách.', 'Đã đặt niềm tin sai người. Giờ lời dặn cố sống của cha là điểm tựa.', ['Sống để trở về gặp gia đình', 'Không bỏ mặc người đã giúp mình'], 'Cậu vẫn giữ một mẩu giấy ghi số điện thoại của cha.', ['Còn mệt và đau; không có khả năng vượt mọi rào cản chỉ bằng ý chí.'], mood(72, 58, 28, 68), '#9b8afb'),
      character('hoan', 'Thiếu Hoàn', 'Người tìm đồng minh', 'Thận trọng với lời nói, liều lĩnh khi sợ cơ hội vụt mất.', 'Đã nhiều lần thay đổi ý định vì chứng kiến hậu quả của thất bại.', ['Tìm một người đáng tin để cùng hành động', 'Rời khỏi nơi này'], 'Anh chưa chắc thông tin mình thu thập còn đúng.', [], mood(65, 42, 51, 25), '#6ccfbd'),
      character('lytu', 'Lý Tử', 'Người vừa có đặc quyền', 'Tỉnh táo, kín đáo; biết dùng sự im lặng để bảo vệ mình.', 'Từng chia phần ăn với Tiểu Hoa. Nay có điều kiện sống tốt hơn nhưng vẫn bị kiểm soát.', ['Bảo vệ chút an toàn vừa giành được', 'Trả món nợ với Tiểu Hoa mà không để lộ mình'], 'Cô nghe tin những người được chuyển đi chưa chắc đã tự do.', [], mood(44, 32, 37, 61), '#efad77'),
      character('tai', 'Tài Gia', 'Người quản lý', 'Giỏi đọc sự sợ hãi, luôn tính lợi ích; ghét việc nằm ngoài dự đoán.', 'Được giao duy trì hoạt động, nhưng cũng bị cấp trên giám sát.', ['Giữ trật tự trước đợt kiểm tra', 'Giữ quyền lực và che giấu sai sót'], 'Ông sợ bản báo cáo sáng mai hơn là những lời đe dọa của người bị giữ.', [], mood(39, 27, 65, 5), '#82b1f5'),
    ],
    style: { voice: 'Ngôi thứ nhất giới hạn, văn xuôi sinh tồn giàu cảm giác.', guidance: 'Dùng hy vọng ngắn ngủi và cái giá của lựa chọn để tạo căng thẳng. Đồng minh có mục tiêu riêng, có thể do dự hoặc thay đổi. Không định trước việc thoát thành công hay thất bại.', words: 650 },
  },
];

export const defaultConfig = { mode: 'batch', max_scenes: 6, max_turns: 6, batch_size: 3, memory_limit: 12 };
presets.push(createMysteryPreset(presets[0]));
