-- 開発用のテストデータ
-- テストユーザーのデータを削除してから挿入
DELETE FROM analyses WHERE user_id IN ('test-user-001', 'test-user-002');
DELETE FROM summaries WHERE user_id IN ('test-user-001', 'test-user-002');
DELETE FROM entries WHERE user_id IN ('test-user-001', 'test-user-002');

-- テストユーザー1のエントリー
INSERT INTO entries (user_id, content, created_at) VALUES
('test-user-001', '今日は新しいプロジェクトを始めました。わくわくする反面、少し不安もあります。でも、きっと大丈夫だと思います。', datetime('now', '-7 days')),
('test-user-001', '朝から雨が降っていて、少し憂鬱な気分でした。でも、コーヒーを飲んだら元気が出てきました。', datetime('now', '-6 days')),
('test-user-001', 'プロジェクトの進捗が順調で嬉しいです。チームメンバーとのコミュニケーションもうまくいっています。', datetime('now', '-5 days')),
('test-user-001', '今日は疲れました。でも、達成感もあります。明日はもっと効率的に作業したいです。', datetime('now', '-4 days')),
('test-user-001', '週末なのでゆっくり過ごしました。読書をしたり、散歩をしたりして、リフレッシュできました。', datetime('now', '-3 days')),
('test-user-001', '友人と久しぶりに会いました。楽しい時間を過ごせて、エネルギーをもらえました。', datetime('now', '-2 days')),
('test-user-001', '新しい技術を学び始めました。難しいけど、成長を感じられて楽しいです。', datetime('now', '-1 days'));

-- テストユーザー2のエントリー
INSERT INTO entries (user_id, content, created_at) VALUES
('test-user-002', '運動を始めました。体を動かすと気持ちがすっきりします。継続したいです。', datetime('now', '-5 days')),
('test-user-002', '仕事で小さなミスをしてしまいました。落ち込みましたが、次は気をつけようと思います。', datetime('now', '-3 days')),
('test-user-002', '今日は料理に挑戦しました。思ったよりうまくできて、自信がつきました。', datetime('now', '-1 days'));

-- テストユーザー1の分析結果
INSERT INTO analyses (entry_id, user_id, emotion, themes, patterns, positive_points) VALUES
((SELECT id FROM entries WHERE user_id = 'test-user-001' ORDER BY created_at DESC LIMIT 1 OFFSET 6), 'test-user-001', 
 '期待と不安が入り混じった複雑な感情', '新しい挑戦、始まり', '前向きに挑戦する姿勢', '新しいことに挑戦する勇気が素晴らしいです'),
((SELECT id FROM entries WHERE user_id = 'test-user-001' ORDER BY created_at DESC LIMIT 1 OFFSET 5), 'test-user-001', 
 '憂鬱から回復へ', '天気の影響、セルフケア', '小さな行動で気分転換を図る', 'コーヒーで気分転換できる対処法を持っています'),
((SELECT id FROM entries WHERE user_id = 'test-user-001' ORDER BY created_at DESC LIMIT 1 OFFSET 4), 'test-user-001', 
 '喜び、満足感', '仕事の成功、チームワーク', '協調性を大切にする', 'チームワークを重視する姿勢が成功につながっています');

-- テストユーザー1の要約
INSERT INTO summaries (user_id, start_date, end_date, summary_content) VALUES
('test-user-001', date('now', '-7 days'), date('now'), 
 '新しいプロジェクトへの挑戦から始まり、初期の不安を乗り越えて順調に進捗している。天気や疲労による気分の変動はあるものの、適切なセルフケアとリフレッシュ活動により、バランスを保っている。友人との交流や新しい学習への意欲など、前向きな成長志向が見られる。');

-- テストユーザー2の分析結果  
INSERT INTO analyses (entry_id, user_id, emotion, themes, patterns, positive_points) VALUES
((SELECT id FROM entries WHERE user_id = 'test-user-002' ORDER BY created_at DESC LIMIT 1 OFFSET 2), 'test-user-002', 
 'すっきり、意欲的', '健康、新習慣', '健康的な習慣を始める', '運動習慣を始めた行動力が素晴らしいです'),
((SELECT id FROM entries WHERE user_id = 'test-user-002' ORDER BY created_at DESC LIMIT 1 OFFSET 1), 'test-user-002', 
 '落ち込み、反省', 'ミス、学習', '失敗から学ぶ姿勢', 'ミスを次への学びにする前向きな姿勢があります'),
((SELECT id FROM entries WHERE user_id = 'test-user-002' ORDER BY created_at DESC LIMIT 1 OFFSET 0), 'test-user-002', 
 '達成感、自信', '挑戦、料理', '新しいスキルへの挑戦', '料理という新しいスキルに挑戦する積極性が良いです');