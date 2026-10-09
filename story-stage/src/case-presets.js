// Fixed past, observable evidence, and open choices. No future scene script.
export function createMysteryPreset(base) {
  const p = structuredClone(base);
  p.id = 'rain-case'; p.name = 'Hồ sơ dưới cơn mưa';
  p.description = 'Một biên bản bị sửa. Dấu vết giống nhau, cách hiểu khác nhau. Hồ sơ vụ án đã sẵn sàng.';
  p.premise = 'Tần Phong tới đồn hỏi về cái chết của chó dẫn đường Tiểu Thu. Anh nói mình đã làm một người biến mất, nhưng chưa nói việc đó nghĩa là gì. Tề Quân nhận ra tên trong một biên bản cũ. Lâm Tước đang tìm người mất tích ấy. Bác Từ giữ chìa khóa kho giấy. Không ai buộc phải thú nhận, và cuộc điều tra chưa có kết cục.';
  p.world.facts = p.world.facts.filter(f => !['f-thu', 'f-report'].includes(f.id));
  const fact = (id, text, known_by = [], claim) => ({ id, text, known_by, ...(claim ? { claim } : {}) });
  p.world.facts.push(
    fact('f-thu', 'Tiểu Thu là chó dẫn đường của Tần Phong, không phải một cô bé.', ['phong'], { key: 'identity-thu', value: 'guide-dog' }),
    fact('f-report', 'Tề Quân nộp bản gốc có dòng ghi tên nhân chứng; Lâm Tước xóa dòng đó sau khi nhận hồ sơ.', ['lam', 'tu'], { key: 'report-editor', value: 'lam' }),
    fact('f-witness', 'Người đang bị tìm kiếm là nhân chứng từng thấy xe công vụ gây tai nạn làm Tiểu Thu chết.', ['tu'], { key: 'missing-role', value: 'witness' }),
    fact('f-safe', 'Trước khi cuộc điều tra bắt đầu, người mất tích đã được đưa tới phòng khám An Bình và còn sống lúc nhập viện.', ['tu'], { key: 'witness-at-admission', value: 'alive-at-an-binh' }),
    fact('f-protection', 'Bác Từ giấu địa chỉ và giữ bản gốc để bảo vệ nhân chứng; ông chưa quyết định có cung cấp chúng hay không.', ['tu'], { key: 'hidden-address-motive', value: 'protect-witness' }),
    fact('e-collar', 'Trong túi của Phong có vòng cổ khắc chữ Tiểu Thu và hai rãnh dành cho dây dắt.'),
    fact('e-copy', 'Bản sao trong hồ sơ có chữ ký tiếp nhận của Tề Quân và một khoảng trống ở dòng nhân chứng.'),
    fact('e-original', 'Bản giấy Bác Từ giữ có tên nhân chứng ở dòng thứ ba và dấu tiếp nhận 18:20.'),
    fact('e-log', 'Nhật ký chỉnh sửa ghi tài khoản lam xóa dòng thứ ba lúc 18:43, sau mốc tiếp nhận 18:20.'),
    fact('e-dispatch', 'Sổ điều xe ngày xảy ra tai nạn ghi xe công vụ đi qua ngõ nhân chứng đã nêu, đúng khoảng giờ Tiểu Thu chết.'),
    fact('e-clinic', 'Phiếu tiếp nhận phòng khám An Bình có mã người đang mất tích, mạch và chữ ký người đưa tới là Bác Từ.')
  );
  const char = id => p.characters.find(c => c.id === id);
  char('phong').secret = 'Anh biết Tiểu Thu là chó dẫn đường; anh dùng lời nói mơ hồ để thử xem ai còn nhớ biên bản.';
  char('quan').secret = 'Cô nhớ mình đã ghi đủ lời khai nhưng sợ không ai tin nếu bản giấy đã mất.';
  char('quan').beliefs = [{ text: 'Có thể tôi đã bỏ sót dòng nhân chứng trong lúc ghi lời khai.', confidence: 45, evidence_fact_ids: [] }];
  char('lam').secret = 'Anh xóa dòng nhân chứng trong biên bản sau khi Tề Quân nộp, để tránh bị truy trách nhiệm.';
  char('tu').secret = 'Ông giữ bản gốc và đã đưa nhân chứng tới phòng khám An Bình; ông sợ lộ địa chỉ khiến người ấy gặp nguy hiểm.';
  const clue = (id, title, evidence_fact_id, location, discovery_condition, surface_reading, deeper_reading, truth_fact_ids) => ({ id, title, evidence_fact_id, location, discovery_condition, surface_reading, deeper_reading, truth_fact_ids });
  p.casefile = {
    central_question: 'Vì sao một dòng nhân chứng biến mất khỏi biên bản, và người mất tích có thực sự là nạn nhân của Phong?',
    truths: [
      { fact_id: 'f-thu', required_clue_ids: ['c-collar'] },
      { fact_id: 'f-report', required_clue_ids: ['c-copy', 'c-original', 'c-log'] },
      { fact_id: 'f-witness', required_clue_ids: ['c-original', 'c-dispatch'] },
      { fact_id: 'f-safe', required_clue_ids: ['c-clinic'] },
      { fact_id: 'f-protection', required_clue_ids: [] },
    ],
    timeline: [
      { id: 'past-accident', at: 'Ba ngày trước', text: 'Tiểu Thu chết trong một tai nạn có nhân chứng.', fact_ids: ['f-thu', 'f-witness'] },
      { id: 'past-report', at: 'Hai ngày trước · 18:20–18:43', text: 'Bản gốc được tiếp nhận rồi mất dòng nhân chứng trong bản lưu.', fact_ids: ['f-report', 'e-original', 'e-log'] },
      { id: 'past-shelter', at: 'Trước mô phỏng', text: 'Bác Từ giữ bản giấy và đưa nhân chứng tới nơi điều trị.', fact_ids: ['f-safe', 'f-protection'] },
    ],
    clues: [
      clue('c-collar', 'Vòng cổ mang tên Tiểu Thu', 'e-collar', 'Túi áo Tần Phong', 'Phong tự đưa ra, hoặc cho phép người khác sờ/kiểm tra vòng cổ.', 'Tên riêng có thể khiến người nghe nghĩ tới một cô bé.', 'Rãnh dây dắt cho thấy tên ấy thuộc chó dẫn đường.', ['f-thu']),
      clue('c-copy', 'Khoảng trống dưới chữ ký', 'e-copy', 'Tủ hồ sơ phòng thẩm vấn', 'Một người lấy bản sao và đọc, hoặc đọc thành tiếng cho Phong.', 'Chữ ký của Quân khiến cô bị nghi đã bỏ sót nhân chứng.', 'Chữ ký chỉ xác nhận tiếp nhận, chưa chứng minh ai sửa nội dung.', ['f-report']),
      clue('c-original', 'Bản giấy có dòng thứ ba', 'e-original', 'Ngăn tủ Bác Từ', 'Bác Từ đồng ý mở tủ; người nhận đọc bản gốc hoặc được đọc cho nghe.', 'Người giữ bản gốc có thể đang che giấu sai phạm của mình.', 'Đối chiếu bản gốc cho thấy dòng nhân chứng đã tồn tại khi tiếp nhận.', ['f-report', 'f-witness', 'f-protection']),
      clue('c-log', 'Mốc sửa 18:43', 'e-log', 'Máy tính lưu hồ sơ', 'Một người có quyền truy cập mở nhật ký và đối chiếu bản gốc, có thể chia sẻ cho người có mặt.', 'Một lần sửa hồ sơ có thể là chỉnh lỗi đánh máy.', 'Thời điểm và tài khoản gắn việc mất dòng với Lâm Tước, sau khi Quân nộp.', ['f-report']),
      clue('c-dispatch', 'Chuyến xe qua con ngõ', 'e-dispatch', 'Sổ điều xe trong kho', 'Tìm đúng ngày và đối chiếu địa điểm với lời khai trong bản gốc.', 'Xe công vụ đi qua ngõ có thể không liên quan.', 'Khi ghép với lời khai, người mất tích trở thành nhân chứng của vụ Tiểu Thu.', ['f-witness']),
      clue('c-clinic', 'Mã tiếp nhận An Bình', 'e-clinic', 'Phong bì Bác Từ giữ', 'Bác Từ mở phong bì hoặc cho phép đối chiếu mã tiếp nhận; người nghe được đọc đầy đủ dấu mạch và chữ ký.', 'Việc giấu địa chỉ dễ bị hiểu là giúp thủ phạm phi tang.', 'Dấu mạch xác nhận người ấy sống lúc nhập viện, chữ ký cho thấy hành động bảo vệ.', ['f-safe', 'f-protection']),
    ],
    questions: [
      { id: 'q-thu', text: 'Tiểu Thu thực sự là ai?', answer_fact_ids: ['f-thu'], required_clue_ids: ['c-collar'] },
      { id: 'q-report', text: 'Ai đã làm dòng nhân chứng biến mất khỏi biên bản?', answer_fact_ids: ['f-report'], required_clue_ids: ['c-copy', 'c-original', 'c-log'] },
      { id: 'q-missing', text: 'Người mất tích liên quan gì tới Tiểu Thu và còn sống lúc rời khỏi đồn không?', answer_fact_ids: ['f-witness', 'f-safe'], required_clue_ids: ['c-original', 'c-dispatch', 'c-clinic'] },
      { id: 'q-tu', text: 'Vì sao Bác Từ giữ bản gốc và giấu địa chỉ?', answer_fact_ids: ['f-protection'], required_clue_ids: ['c-original', 'c-clinic'] },
    ],
  };
  return p;
}
