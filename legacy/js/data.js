/* ============================================================
 * 数据：杭州湾（慈溪）鸟种图鉴 + 观鸟点
 * rare: 0 常见 | 1 少见 | 2 珍稀
 * live: 留鸟 | 冬候鸟 | 夏候鸟 | 旅鸟(春秋迁徙过境)
 * x/y: 手绘地图上的标记位置（百分比）
 * ============================================================ */

const CATS = [
  { id: "heron",  name: "鹭鸟",       emoji: "🕊️", color: "#7fb5d6" },
  { id: "duck",   name: "雁鸭",       emoji: "🦆", color: "#e8a87c" },
  { id: "shore",  name: "鸻鹬",       emoji: "🏝️", color: "#d9a441" },
  { id: "gull",   name: "鸥与燕鸥",   emoji: "🕊️", color: "#9db4c0" },
  { id: "water",  name: "䴙䴘与水鸟", emoji: "🌊", color: "#5f9ea0" },
  { id: "raptor", name: "猛禽",       emoji: "🦅", color: "#8b7355" },
  { id: "forest", name: "林鸟",       emoji: "🌳", color: "#7aa874" },
  { id: "custom", name: "我们的收藏", emoji: "💫", color: "#e88b94" },
];

const BIRDS = [
  /* ---- 鹭鸟 ---- */
  { id:"b001", name:"白鹭",       latin:"Egretta garzetta",  cat:"heron", rare:0, live:"留鸟",   note:"一身雪白配黑嘴黄脚，湿地里最优雅的常客，飞行时脖子缩成 S 形。", emoji:"🕊️" },
  { id:"b002", name:"大白鹭",     latin:"Ardea alba",        cat:"heron", rare:0, live:"冬候鸟", note:"比白鹭大一圈，黄嘴黑脚；繁殖季背上会披一层细纱般的蓑羽。", emoji:"🕊️" },
  { id:"b003", name:"苍鹭",       latin:"Ardea cinerea",     cat:"heron", rare:0, live:"冬候鸟", note:"灰衣长颈的老先生，捕鱼时一站半小时，人送外号'老等'。", emoji:"🕊️" },
  { id:"b004", name:"夜鹭",       latin:"Nycticorax nycticorax", cat:"heron", rare:0, live:"留鸟", note:"白天在树上打盹、夜里出门的'夜行侠'，亚成鸟一身褐色麻点像穿了迷彩。", emoji:"🌙" },
  { id:"b005", name:"池鹭",       latin:"Ardeola bacchus",   cat:"heron", rare:0, live:"夏候鸟", note:"繁殖季头颈变成漂亮的栗红色，平时低调地一身褐色纵纹。", emoji:"🕊️" },
  { id:"b006", name:"牛背鹭",     latin:"Bubulcus ibis",     cat:"heron", rare:1, live:"夏候鸟", note:"最爱站在水牛背上捉虫，繁殖期一身橙色'炸毛'格外喜庆。", emoji:"🐂" },
  { id:"b007", name:"中白鹭",     latin:"Mesophoyx intermedia", cat:"heron", rare:1, live:"旅鸟", note:"体型介于大白鹭和白鹭之间，嘴上黑黄各半是它的身份证。", emoji:"🕊️" },
  { id:"b008", name:"大麻鳽",     latin:"Botaurus stellaris", cat:"heron", rare:1, live:"冬候鸟", note:"芦苇丛里的伪装大师，受惊时嘴朝天'竖'成一根芦苇，一动不动。", emoji:"🌾" },
  { id:"b009", name:"黄斑苇鳽",   latin:"Ixobrychus sinensis", cat:"heron", rare:1, live:"夏候鸟", note:"迷你小苇鳽，橙黄色身子，喜欢在荷塘芦苇间猫着腰走路。", emoji:"🌾" },
  { id:"b010", name:"绿鹭",       latin:"Butorides striata", cat:"heron", rare:1, live:"夏候鸟", note:"深灰绿色的小型鹭，聪明的它会往水面丢小虫'钓鱼'。", emoji:"🎣" },

  /* ---- 雁鸭 ---- */
  { id:"b011", name:"小天鹅",     latin:"Cygnus columbianus", cat:"duck", rare:2, live:"冬候鸟", note:"国家二级保护，弯弯的脖子和优雅的身姿，冬日的湿地因它而浪漫。", emoji:"🦢" },
  { id:"b012", name:"鸿雁",       latin:"Anser cygnoides",   cat:"duck", rare:2, live:"冬候鸟", note:"家鹅的野生祖先，长长的脖子向前倾，'鸿雁传书'说的就是它。", emoji:"🪿" },
  { id:"b013", name:"豆雁",       latin:"Anser fabalis",     cat:"duck", rare:1, live:"冬候鸟", note:"嘴上有一块黄色'豆斑'，秋天 V 字形雁阵的主力选手。", emoji:"🪿" },
  { id:"b014", name:"罗纹鸭",     latin:"Mareca falcata",    cat:"duck", rare:2, live:"冬候鸟", note:"近危物种。雄鸟头顶闪着金属绿光，胸前的罗纹像穿了织锦。", emoji:"🦆" },
  { id:"b015", name:"斑嘴鸭",     latin:"Anas zonorhyncha",  cat:"duck", rare:0, live:"留鸟",   note:"嘴尖一点黄斑，杭州湾数量最多的鸭子，也是家鸭的亲戚。", emoji:"🦆" },
  { id:"b016", name:"绿头鸭",     latin:"Anas platyrhynchos", cat:"duck", rare:0, live:"冬候鸟", note:"绿脑袋白颈环，是最大家鸭的祖先，冬天成群停在水面打盹。", emoji:"🦆" },
  { id:"b017", name:"绿翅鸭",     latin:"Anas crecca",       cat:"duck", rare:0, live:"冬候鸟", note:"袖珍小鸭，翅膀上有一抹金属绿'翼镜'，起飞时一闪一闪。", emoji:"🦆" },
  { id:"b018", name:"针尾鸭",     latin:"Anas acuta",        cat:"duck", rare:1, live:"冬候鸟", note:"尾羽细长如针，脖子修长，是鸭群里的'超模身材'。", emoji:"🦆" },
  { id:"b019", name:"琵嘴鸭",     latin:"Spatula clypeata",  cat:"duck", rare:1, live:"冬候鸟", note:"一把琵琶大嘴贴着水面左右扫，吃饭的样子十分可爱。", emoji:"🦆" },
  { id:"b020", name:"花脸鸭",     latin:"Sibirionetta formosa", cat:"duck", rare:2, live:"冬候鸟", note:"易危物种。雄鸟像画了张彩色花脸谱，曾因'鸭饭'被大量捕食，遇见请珍惜。", emoji:"🎭" },
  { id:"b021", name:"青头潜鸭",   latin:"Aythya baeri",      cat:"duck", rare:2, live:"冬候鸟", note:"极危！全球仅千只左右的'鸟中大熊猫'，杭州湾偶有记录，看到就是大大大运气。", emoji:"🐼" },
  { id:"b022", name:"鸳鸯",       latin:"Aix galericulata",  cat:"duck", rare:2, live:"留鸟",   note:"国家二级。爱情的象征，雄鸟一身'京剧戏服'，古人叫它'匹鸟'。", emoji:"💞" },

  /* ---- 鸻鹬 ---- */
  { id:"b023", name:"黑翅长脚鹬", latin:"Himantopus himantopus", cat:"shore", rare:1, live:"旅鸟", note:"一双粉红色大长腿，浅水里的'湿地超模'，走路优雅得像踩高跷。", emoji:"🦵" },
  { id:"b024", name:"反嘴鹬",     latin:"Recurvirostra avosetta", cat:"shore", rare:1, live:"冬候鸟", note:"喙向上翘起，黑白配色像穿了燕尾服，觅食时镰刀般左右扫水。", emoji:"🎛️" },
  { id:"b025", name:"凤头麦鸡",   latin:"Vanellus vanellus", cat:"shore", rare:0, live:"冬候鸟", note:"头顶一根'冲天辫'，翼上泛着绿紫色金属光，飞起来像蝴蝶。", emoji:"🎀" },
  { id:"b026", name:"环颈鸻",     latin:"Charadrius alexandrinus", cat:"shore", rare:0, live:"留鸟", note:"滩涂上的白色小不点，一截白'项链'，跑起来一顿一顿像上了发条。", emoji:"🏃" },
  { id:"b027", name:"金眶鸻",     latin:"Charadrius dubius", cat:"shore", rare:0, live:"夏候鸟", note:"金色的眼眶像戴了小眼镜，比环颈鸻更小巧玲珑。", emoji:"🤓" },
  { id:"b028", name:"灰鸻",       latin:"Pluvialis squatarola", cat:"shore", rare:1, live:"旅鸟", note:"灰扑扑的背，飞行时腋下一抹黑；能不吃不喝连飞几千公里。", emoji:"✈️" },
  { id:"b029", name:"白腰杓鹬",   latin:"Numenius arquata",  cat:"shore", rare:1, live:"冬候鸟", note:"近危物种。长长的嘴弯成一把镰刀， whistle 般的鸣叫悠远好听。", emoji:"🎷" },
  { id:"b030", name:"大杓鹬",     latin:"Numenius madagascariensis", cat:"shore", rare:2, live:"旅鸟", note:"近危物种。嘴又长又弯的大家伙，迁徙季在杭州湾滩涂'干饭'。", emoji:"🍜" },
  { id:"b031", name:"黑尾塍鹬",   latin:"Limosa limosa",     cat:"shore", rare:2, live:"旅鸟", note:"近危物种。粉色的长嘴又直又细，杭州湾迁徙季的重要客人。", emoji:"🍭" },
  { id:"b032", name:"斑尾塍鹬",   latin:"Limosa lapponica",  cat:"shore", rare:1, live:"旅鸟", note:"世界飞行纪录保持者：能不停歇连飞一万多公里，从新西兰直飞阿拉斯加。", emoji:"🏆" },
  { id:"b033", name:"青脚鹬",     latin:"Tringa nebularia",  cat:"shore", rare:0, live:"冬候鸟", note:"黄绿色的长腿，嘴尖微微上翘，冬天滩涂上的常客。", emoji:"🦩" },
  { id:"b034", name:"红脚鹬",     latin:"Tringa totanus",    cat:"shore", rare:1, live:"冬候鸟", note:"一双鲜红的长腿十分抢眼，飞行时露出白色楔形背斑。", emoji:"🦩" },
  { id:"b035", name:"黑腹滨鹬",   latin:"Calidris alpina",   cat:"shore", rare:0, live:"冬候鸟", note:"冬季杭州湾滩涂的'数量之王'，成千上万只一起飞起像烟雾。", emoji:"🌪️" },
  { id:"b036", name:"红颈滨鹬",   latin:"Calidris ruficollis", cat:"shore", rare:1, live:"旅鸟", note:"拇指大小的迁徙小勇士，一年往返西伯利亚与澳洲。", emoji:"🫘" },

  /* ---- 鸥与燕鸥 ---- */
  { id:"b037", name:"红嘴鸥",     latin:"Larus ridibundus",  cat:"gull", rare:0, live:"冬候鸟", note:"昆明'海鸥'的主力，冬天也成群来到杭州湾，红嘴红脚像涂了口红。", emoji:"🕊️" },
  { id:"b038", name:"黑嘴鸥",     latin:"Larus saundersi",   cat:"gull", rare:2, live:"冬候鸟", note:"易危物种、杭州湾的'明星鸟'！黑嘴黑头罩，全球九成以上在中国沿海越冬。", emoji:"⭐" },
  { id:"b039", name:"西伯利亚银鸥", latin:"Larus vegae",     cat:"gull", rare:1, live:"冬候鸟", note:"冬羽全身麻点像撒了芝麻，是鸥群里的大个子。", emoji:"⚪" },
  { id:"b040", name:"遗鸥",       latin:"Larus relictus",    cat:"gull", rare:2, live:"旅鸟",   note:"国家一级！最后被科学界认识的鸥，名字的意思是'被遗落的鸥'。", emoji:"🏅" },
  { id:"b041", name:"普通燕鸥",   latin:"Sterna hirundo",    cat:"gull", rare:1, live:"夏候鸟", note:"像燕子一样轻盈，收翅俯冲入水抓鱼只在一瞬间。", emoji:"🇨🇭" },
  { id:"b042", name:"白额燕鸥",   latin:"Sternula albifrons", cat:"gull", rare:1, live:"夏候鸟", note:"最小的燕鸥之一，额头一道醒目的白眉，夏天在滩涂上空翻飞。", emoji:"〰️" },

  /* ---- 䴙䴘与水鸟 ---- */
  { id:"b043", name:"小䴙䴘",     latin:"Tachybaptus ruficollis", cat:"water", rare:0, live:"留鸟", note:"外号'王八鸭子'，一有动静就潜水消失；妈妈会驮着宝宝游泳。", emoji:"🐥" },
  { id:"b044", name:"凤头䴙䴘",   latin:"Podiceps cristatus", cat:"water", rare:1, live:"冬候鸟", note:"春天求偶时跳'双人芭蕾'，还会互赠水草作为定情礼物。", emoji:"💃" },
  { id:"b045", name:"普通鸬鹚",   latin:"Phalacrocorax carbo", cat:"water", rare:0, live:"冬候鸟", note:"顶级潜水渔夫，站在木桩上张开黑翅膀晾晒的样子像十字架。", emoji:"🖤" },
  { id:"b046", name:"卷羽鹈鹕",   latin:"Pelecanus crispus", cat:"water", rare:2, live:"冬候鸟", note:"近危物种、国家一级。自带'大口袋'的巨无霸，杭州湾冬日的惊喜。", emoji:"🛍️" },
  { id:"b047", name:"白骨顶",     latin:"Fulica atra",       cat:"water", rare:0, live:"冬候鸟", note:"额头一块白色'盾牌'，起飞前要在水面助跑好远，像水上飞机。", emoji:"🛡️" },
  { id:"b048", name:"黑水鸡",     latin:"Gallinula chloropus", cat:"water", rare:0, live:"留鸟", note:"红额红嘴尖黄，游泳时尾巴一翘一翘，其实它并不会'鸡'泳，是游禽。", emoji:"🐤" },
  { id:"b049", name:"白胸苦恶鸟", latin:"Amaurornis phoenicurus", cat:"water", rare:1, live:"夏候鸟", note:"叫声像在喊'苦恶——苦恶——'，其实它在河边过得挺好。", emoji:"😫" },
  { id:"b050", name:"水雉",       latin:"Hydrophasianus chirurgus", cat:"water", rare:1, live:"夏候鸟", note:"'凌波仙子'，超长脚趾踩在荷叶上如履平地，还实行'一妻多夫'制。", emoji:"🪷" },

  /* ---- 猛禽 ---- */
  { id:"b051", name:"红隼",       latin:"Falco tinnunculus", cat:"raptor", rare:0, live:"留鸟",   note:"国家二级。会迎风'定点悬停'的小猛禽，城市上空也能见到。", emoji:"🦅" },
  { id:"b052", name:"游隼",       latin:"Falco peregrinus",  cat:"raptor", rare:1, live:"冬候鸟", note:"国家二级。俯冲时速可达 380 公里，地球上速度最快的动物。", emoji:"⚡" },
  { id:"b053", name:"普通鵟",     latin:"Buteo buteo",       cat:"raptor", rare:1, live:"冬候鸟", note:"国家二级。'老鹰'本尊，常在田野上空一圈圈盘旋。", emoji:"🌀" },
  { id:"b054", name:"白腹鹞",     latin:"Circus spilonotus", cat:"raptor", rare:1, live:"冬候鸟", note:"国家二级。贴着苇丛低空慢飞，悄悄搜寻苇丛里的猎物。", emoji:"🌾" },
  { id:"b055", name:"鹗",         latin:"Pandion haliaetus", cat:"raptor", rare:1, live:"旅鸟",   note:"国家二级。'鱼鹰'本尊，收翅入水抓鱼一气呵成。", emoji:"🐟" },
  { id:"b056", name:"黑翅鸢",     latin:"Elanus caeruleus",  cat:"raptor", rare:1, live:"留鸟",   note:"国家二级。一身白衣配红眼睛，悬停在空中俯视草丛的高手。", emoji:"❤️" },

  /* ---- 林鸟 ---- */
  { id:"b057", name:"震旦鸦雀",   latin:"Paradoxornis heudei", cat:"forest", rare:2, live:"留鸟", note:"近危、'鸟中大熊猫'，只住在芦苇荡里，杭州湾湿地是它最后的家园之一。", emoji:"🐼" },
  { id:"b058", name:"戴胜",       latin:"Upupa epops",       cat:"forest", rare:0, live:"留鸟",   note:"顶着印第安羽冠的'花蒲扇'，黑白条纹翅膀一开一合像蝴蝶。", emoji:"👑" },
  { id:"b059", name:"普通翠鸟",   latin:"Alcedo atthis",     cat:"forest", rare:0, live:"留鸟",   note:"'打鱼郎'，一道蓝宝石色的闪电掠过水面，惊艳所有人。", emoji:"💎" },
  { id:"b060", name:"黄胸鹀",     latin:"Emberiza aureola",  cat:"forest", rare:2, live:"旅鸟",   note:"极危！曾经的'禾花雀'，十几年间从漫山遍野到极度濒危，遇见请珍惜。", emoji:"💛" },
  { id:"b061", name:"白头鹎",     latin:"Pycnonotus sinensis", cat:"forest", rare:0, live:"留鸟", note:"'白头翁'，小区绿化带最吵的住户之一，其实人家唱歌很好听。", emoji:"⚪" },
  { id:"b062", name:"棕背伯劳",   latin:"Lanius schach",     cat:"forest", rare:0, live:"留鸟",   note:"戴黑色'眼罩'的'小猛禽'，有把猎物挂在树枝上当'腊肉'的习惯。", emoji:"🎭" },
  { id:"b063", name:"珠颈斑鸠",   latin:"Spilopelia chinensis", cat:"forest", rare:0, live:"留鸟", note:"脖子上一条'珍珠项链'，每天在窗外咕咕——咕咕地秀恩爱。", emoji:"📿" },
  { id:"b064", name:"白鹡鸰",     latin:"Motacilla alba",    cat:"forest", rare:0, live:"留鸟",   note:"走路一点一点像在打拍子，飞行一起一伏划出波浪线。", emoji:"〜" },
  { id:"b065", name:"远东山雀",   latin:"Parus minor",       cat:"forest", rare:0, live:"留鸟",   note:"叫声像'绿茶——绿茶——'，黑白黄三色配色的小圆球。", emoji:"🍵" },
  { id:"b066", name:"暗绿绣眼鸟", latin:"Zosterops japonicus", cat:"forest", rare:1, live:"留鸟", note:"眼周一圈白色'绣边'，成群在花间钻来钻去像小绣球。", emoji:"🧵" },
  { id:"b067", name:"红胁蓝尾鸲", latin:"Tarsiger cyanurus", cat:"forest", rare:1, live:"冬候鸟", note:"橙色侧腹+蓝色尾巴的小精灵，冬天在灌丛里一蹦一蹦。", emoji:"🔵" },
  { id:"b068", name:"八哥",       latin:"Acridotheres cristatellus", cat:"forest", rare:0, live:"留鸟", note:"飞行时两翼张开两块白斑，正好一个'八'字，还会学人说话。", emoji:"八字" },
];

/* 观鸟点（x/y 为手绘地图百分比坐标） */
const SPOTS = [
  { id:"s1", name:"杭州湾国家湿地公园", x:78, y:14, emoji:"🌿",
    desc:"世界级观鸟胜地、'鹭鸟天堂'。水上森林里夜鹭、白鹭、苍鹭成千上万，运气好还能碰上黑脸琵鹭。门票制景区，观鸟节期间有保育区观鸟船，需提前一天在公众号预约。",
    best:"4-5月繁殖季 / 11-2月冬候鸟", targets:["白鹭","夜鹭","苍鹭","黑脸琵鹭","反嘴鹬"] },
  { id:"s2", name:"庵东滩涂", x:48, y:10, emoji:"🌊",
    desc:"中国八大盐碱湿地之一、候鸟的'大食堂'。广阔滩涂上迁徙季有数万只鸻鹬，注意查潮汐，涨潮前鸟会被推到堤边，记得带望远镜。",
    best:"3-5月、9-11月迁徙季", targets:["黑腹滨鹬","环颈鸻","青脚鹬","大杓鹬","黑嘴鸥"] },
  { id:"s3", name:"四灶浦沿岸湿地", x:60, y:20, emoji:"🦆",
    desc:"慈溪北部的河道与养殖塘湿地，雁鸭和鹭鸟的聚集地，冬季水面上漂满绿头鸭和斑嘴鸭，适合安静地慢慢扫视。",
    best:"11-2月", targets:["斑嘴鸭","绿头鸭","白骨顶","普通鸬鹚"] },
  { id:"s4", name:"新城河 / 潮塘江", x:55, y:31, emoji:"🌉",
    desc:"市区的河道绿地，'下楼就能观鸟'的日常点位：夜鹭蹲守桥墩，翠鸟贴水飞过，傍晚白鹭排队归巢。",
    best:"全年", targets:["夜鹭","普通翠鸟","白鹭","白鹡鸰"] },
  { id:"s5", name:"峙山公园", x:51, y:36, emoji:"⛰️",
    desc:"市区山体公园，观林鸟的入门点。清晨有'鸟浪'掠过树冠，山雀、绣眼、伯劳都常来报到。",
    best:"全年，清晨最佳", targets:["远东山雀","暗绿绣眼鸟","棕背伯劳","戴胜"] },
  { id:"s6", name:"教场山公园", x:58, y:39, emoji:"🌳",
    desc:"离市中心最近的郊野山林，春秋迁徙季常有小股林鸟过境，适合饭后散步式'轻观鸟'。",
    best:"4-5月、9-10月", targets:["红胁蓝尾鸲","珠颈斑鸠","白头鹎"] },
  { id:"s7", name:"达蓬山", x:82, y:53, emoji:"🦅",
    desc:"慈溪东南部的低山，秋季猛禽迁徙的观察点，天气好的上午抬头数鹰，一圈圈盘旋的场面很震撼。",
    best:"9-11月晴天上午", targets:["普通鵟","红隼","燕隼","鹗"] },
  { id:"s8", name:"白洋湖 · 鸣鹤古镇", x:66, y:53, emoji:"🏮",
    desc:"古镇配水鸟的反差萌点位：湖面冬天有雁鸭和䴙䴘，古镇屋檐下春夏有燕子筑巢，观完鸟还能吃一碗年糕饺。",
    best:"11-2月水鸟 / 夏季燕子", targets:["小䴙䴘","凤头䴙䴘","绿翅鸭"] },
  { id:"s9", name:"栲栳山 · 上林湖", x:40, y:58, emoji:"🏞️",
    desc:"南部山林与水库，山涧溪流边有红尾水鸲和燕尾，水库越冬的水鸟也不少，爬山观鸟两不误。",
    best:"春秋两季", targets:["红胁蓝尾鸲","戴胜","普通翠鸟"] },
];

/* 里程碑（解锁条件由 app.js 计算） */
const MILESTONES = [
  { id:"m01", emoji:"🐣", name:"初次相遇", desc:"写下第一条观鸟记录" },
  { id:"m02", emoji:"🔟", name:"十全十美", desc:"图鉴收集 10 种鸟" },
  { id:"m03", emoji:"🥉", name:"小有所成", desc:"图鉴收集 25 种鸟" },
  { id:"m04", emoji:"🥈", name:"百步穿杨", desc:"图鉴收集 50 种鸟" },
  { id:"m05", emoji:"🥇", name:"鸟类学家", desc:"图鉴收集 75 种鸟" },
  { id:"m06", emoji:"💯", name:"百鸟之约", desc:"图鉴收集 100 种鸟" },
  { id:"m07", emoji:"📅", name:"常来常往", desc:"累计 15 次观鸟记录" },
  { id:"m08", emoji:"🏅", name:"风雨无阻", desc:"累计 30 次观鸟记录" },
  { id:"m09", emoji:"🗺️", name:"走遍慈溪", desc:"打卡 5 个观鸟点" },
  { id:"m10", emoji:"💎", name:"稀有邂逅", desc:"解锁任意一种珍稀鸟" },
  { id:"m11", emoji:"🌟", name:"锦鲤附体", desc:"解锁 3 种珍稀鸟" },
  { id:"m12", emoji:"📸", name:"摄影搭档", desc:"记录里累计 20 张照片" },
];

const WEATHERS = [
  { id:"sunny", emoji:"☀️", name:"晴" },
  { id:"cloudy", emoji:"⛅", name:"多云" },
  { id:"overcast", emoji:"☁️", name:"阴" },
  { id:"rain", emoji:"🌧️", name:"雨" },
  { id:"fog", emoji:"🌫️", name:"雾" },
  { id:"snow", emoji:"❄️", name:"雪" },
];
