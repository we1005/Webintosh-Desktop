/*
 * Music-Player —— 源码级移植 thanas-os 的 Apple Music App（MIT，忠实复刻）。
 * 原生 ES module，无 React。注入后自执行，独立窗口 + 独立 <audio> 实例。
 *
 * 数据/视图/播放逻辑 1:1 复刻：
 *  - 曲目元数据数组 TRACK_DATA / TRACKS（约 63 首）整段照搬自 thanas-os/src/lib/nowPlaying.ts，
 *    真实 mzstatic 封面图 URL + iTunes 30s 预览音源 URL。
 *  - 视图：home（Featured/Charts 网格 + 各分类横向列表）/ charts / songs / albums / artists /
 *    favorites + 8 个分类歌单，参考 AppleMusicApp.tsx。
 *  - albums / artists 用 Map 真正按 album / artist 分组聚合。
 *  - 单个惰性创建的 HTMLAudioElement 驱动：playTrack / togglePlay / next / prev（取模环绕）/
 *    seekTo / setVolume；timeupdate 更新进度，ended 自动下一首。
 *
 * 与现有「音乐播放器」「音乐」「Spotify」隔离：独立窗口/根 class .musicplayer2app /独立 audio 实例。
 */
(() => {
    const win =
        document.getElementById("Music-Player") ||
        document.querySelector(".musicplayer2app.window");
    // 防重入：create() 注入脚本可能重复执行
    if (!win || win.dataset.bound === "1") return;
    win.dataset.bound = "1";

    const ACCENT = "#fa2d48";

    /* ===================================================================
     * 曲目元数据（照搬 thanas-os/src/lib/nowPlaying.ts 的 TRACK_DATA）
     * 键 "title|||artist" -> { previewUrl, cover, album }
     * =================================================================== */
    const TRACK_DATA = {
        // ── English Mix ──
        "Cradles|||Sub Urban": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/e7/73/9a/e7739aa7-78e0-b151-7020-855263b2b637/mzaf_72505415590787732.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/7b/bd/88/7bbd8845-ace6-cbba-1925-834b3e1b47ac/8721465222470.png/600x600bb.jpg", album: "Cradles - Single" },
        "Blinding Lights|||The Weeknd": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/17/b4/8f/17b48f9a-0b93-6bb8-fe1d-3a16623c2cfb/mzaf_9560252727299052414.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/a6/6e/bf/a66ebf79-5008-8948-b352-a790fc87446b/19UM1IM04638.rgb.jpg/600x600bb.jpg", album: "Blinding Lights - Single" },
        "Levitating|||Dua Lipa": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/59/dc/4d/59dc4dda-93ff-8f1c-c536-f005f6ea6af5/mzaf_3066686759813252385.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/6c/11/d6/6c11d681-aa3a-d59e-4c2e-f77e181026ab/190295092665.jpg/600x600bb.jpg", album: "Future Nostalgia" },
        "bad guy|||Billie Eilish": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/c3/87/1f/c3871f7e-3260-d615-1c66-5fdca2c3a48f/mzaf_10721331211699880949.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/1a/37/d1/1a37d1b1-8508-54f2-f541-bf4e437dda76/19UMGIM05028.rgb.jpg/600x600bb.jpg", album: "WHEN WE ALL FALL ASLEEP, WHERE DO WE GO?" },
        "Viva La Vida|||Coldplay": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview116/v4/2b/04/65/2b0465c3-2db1-e461-2362-14b528456b8f/mzaf_1805426141027060154.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/52/aa/85/52aa851f-15b7-6322-f91f-df84b15b7b19/190295978044.jpg/600x600bb.jpg", album: "Viva La Vida or Death and All His Friends" },
        "Counting Stars|||OneRepublic": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/b0/db/7f/b0db7fbe-f8ff-1f67-fe72-ca8185ffbca2/mzaf_15298650366584767800.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/25/46/a7/2546a71a-b2bb-b4c9-4c52-a4daa3ae23ca/13UMGIM15076.rgb.jpg/600x600bb.jpg", album: "Native (Deluxe)" },
        "Shape of You|||Ed Sheeran": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/44/c7/4f/44c74f0d-72dc-6143-d4d0-ba14d661ca0d/mzaf_9566898362556366703.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/15/e6/e8/15e6e8a4-4190-6a8b-86c3-ab4a51b88288/190295851286.jpg/600x600bb.jpg", album: "÷ (Deluxe)" },
        "Uptown Funk|||Mark Ronson": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview126/v4/62/e1/98/62e19826-cd13-6eff-390e-dbca502bb7b5/mzaf_8006535252627949661.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/7e/30/c5/7e30c572-aa47-5f7b-c6fd-42d50cd2c56d/886444959797.jpg/600x600bb.jpg", album: "Uptown Special" },
        "Watermelon Sugar|||Harry Styles": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview116/v4/16/86/f5/1686f50d-8b77-7e32-85f7-5f0e804d68fe/mzaf_14195633304344507287.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/2b/c4/c9/2bc4c9d4-3bc6-ab13-3f71-df0b89b173de/886448022213.jpg/600x600bb.jpg", album: "Fine Line" },
        "Physical|||Dua Lipa": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/87/45/78/874578c1-d683-d1e6-00e4-08848279fa3a/mzaf_17519393520049027931.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/6c/11/d6/6c11d681-aa3a-d59e-4c2e-f77e181026ab/190295092665.jpg/600x600bb.jpg", album: "Future Nostalgia" },
        "As It Was|||Harry Styles": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/67/10/16/67101606-3869-ca44-6c03-e13d6322cb51/mzaf_1135399237022217274.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/2a/19/fb/2a19fb85-2f70-9e44-f2a9-82abe679b88e/886449990061.jpg/600x600bb.jpg", album: "Harry's House" },
        "Flowers|||Miley Cyrus": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/68/9e/f7/689ef7fe-14fe-a846-c87f-7d3b2d6344b1/mzaf_4167137058064023087.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/8c/67/ff/8c67ff91-31c3-3fef-1884-ce3ec89f3af4/196589946874.jpg/600x600bb.jpg", album: "Endless Summer Vacation" },
        "Anti-Hero|||Taylor Swift": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/1d/56/2a/1d562a07-dc5f-a9c0-1f36-2051a8c14eb7/mzaf_7214829135431340590.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/3d/01/f2/3d01f2e5-5a08-835f-3d30-d031720b2b80/22UM1IM07364.rgb.jpg/600x600bb.jpg", album: "Midnights" },
        "Stay|||The Kid LAROI": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/e1/2e/9a/e12e9a9d-6dc1-735e-2ce5-f1d45e8ca23b/mzaf_4716692252568031804.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/f5/7a/9e/f57a9e6a-31c8-0784-dfbd-4a0120bfd4af/21UMGIM17517.rgb.jpg/600x600bb.jpg", album: "Justice" },

        // ── Indie / Rock ──
        "Mr. Brightside|||The Killers": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/b3/95/6e/b3956e14-35f0-937e-afb0-72774d3f613f/mzaf_8359343604382181711.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/11/64/9c/11649c80-2066-dba8-77a9-df7eecae26c1/17UM1IM06937.rgb.jpg/600x600bb.jpg", album: "Direct Hits" },
        "Seven Nation Army|||The White Stripes": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/61/54/97/61549744-a83b-1c4d-58cf-e56b36beb4a7/mzaf_1246579179619940831.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/07/25/09/0725098a-09f4-f240-e551-94384a590371/886448799009.jpg/600x600bb.jpg", album: "Elephant" },
        "Feel Good Inc.|||Gorillaz": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview126/v4/51/ec/df/51ecdf14-b30c-4e55-8d1b-67073cbc16c4/mzaf_8877212452170183777.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/1c/0f/81/1c0f818a-e458-dd84-6f1b-ccbdf5fe14d6/825646291045.jpg/600x600bb.jpg", album: "Demon Days" },
        "Believer|||Imagine Dragons": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/7d/9c/8d/7d9c8d77-dc2c-6ab5-540a-063016ea0ee2/mzaf_13607919425161609621.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/11/7a/b8/117ab805-6811-8929-18b9-0fad7baf0c25/17UMGIM98210.rgb.jpg/600x600bb.jpg", album: "Evolve" },
        "Do I Wanna Know?|||Arctic Monkeys": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview123/v4/df/c3/9c/dfc39caa-a559-b5ac-5b50-472a1c300ca6/mzaf_14741548917211029550.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music113/v4/cc/0f/2d/cc0f2d02-5ff1-10e7-eea2-76863a55dbad/887828031795.png/600x600bb.jpg", album: "AM" },
        "Bohemian Rhapsody|||Queen": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/8f/11/52/8f1152a9-fd5f-0021-f546-b97579c22ec3/mzaf_3962258993076347789.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/4d/08/2a/4d082a9e-7898-1aa1-a02f-339810058d9e/14DMGIM05632.rgb.jpg/600x600bb.jpg", album: "Greatest Hits I, II & III: The Platinum Collection" },
        "Somebody That I Used to Know|||Gotye": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/f9/9c/55/f99c553e-7be1-91dc-b55e-3da1aad29bba/mzaf_5038171343466446420.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/b3/8a/98/b38a9867-2a9c-de2f-2d80-c624fb2200ec/11UMGIM19347.rgb.jpg/600x600bb.jpg", album: "Making Mirrors" },
        "Pumped Up Kicks|||Foster the People": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/dd/a9/80/dda980a0-3b62-f7b7-9588-11b929a30b3c/mzaf_4007504837203131685.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/ba/07/5b/ba075b3c-f0c4-b519-59f3-7ae74d43246b/dj.lajxsvkg.jpg/600x600bb.jpg", album: "Torches" },

        // ── Hip-Hop ──
        "SICKO MODE|||Travis Scott": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/85/49/e2/8549e207-7ecf-21a9-7b2f-b414175c6a74/mzaf_10189975321658500285.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/e7/49/8f/e7498f65-df8f-bead-d6e3-2a8d4d642a79/886447235317.jpg/600x600bb.jpg", album: "ASTROWORLD" },
        "HUMBLE.|||Kendrick Lamar": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/30/3f/27/303f27c8-1997-8c57-66b3-b67e7c720779/mzaf_5598476068977070849.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/ab/16/ef/ab16efe9-e7f1-66ec-021c-5592a23f0f9e/17UMGIM88793.rgb.jpg/600x600bb.jpg", album: "DAMN." },
        "God's Plan|||Drake": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/da/7d/f1/da7df14b-8ee6-5020-d850-ccc0381eb141/mzaf_5511967710095380808.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/bb/6d/8f/bb6d8f67-6d04-10b5-dd62-eb5809ac54fc/00602567879152.rgb.jpg/600x600bb.jpg", album: "Scorpion" },
        "Old Town Road|||Lil Nas X": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/9b/1f/b9/9b1fb99c-9111-91da-9296-5ab8d82028ee/mzaf_11237315064991720435.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/07/d4/c3/07d4c33e-b793-d78f-bb1b-52f1e224da88/886447788264.jpg/600x600bb.jpg", album: "7" },
        "Without Me|||Eminem": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/7d/38/ff/7d38ff16-b52c-063a-a34d-767e836befcc/mzaf_13413071545825673354.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music118/v4/dd/5c/e6/dd5ce621-f7d2-f767-7a08-e7a7eaa7870b/00602537526994.rgb.jpg/600x600bb.jpg", album: "The Eminem Show" },

        // ── Electronic ──
        "Animals|||Martin Garrix": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview116/v4/a1/75/48/a1754841-d05c-0402-bdee-16d724ae47a2/mzaf_16624181595158272558.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/6e/1e/f0/6e1ef055-195a-bb73-d5a8-5926058366a5/8712944577525.png/600x600bb.jpg", album: "Animals - Single" },
        "Wake Me Up|||Avicii": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/68/1e/60/681e601f-e1f2-4ebb-37de-adf00bdf57b6/mzaf_8266263075137964740.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/18/5b/1e/185b1ef5-5d97-19d8-aebf-8e29e41874ef/13UAAIM59255.rgb.jpg/600x600bb.jpg", album: "True" },
        "Faded|||Alan Walker": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/f4/32/01/f43201b9-4bba-7654-2e43-d59e2d907e9f/mzaf_2440137894989713967.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/0d/a3/1a/0da31af7-d0ff-9bee-c427-1b6d0336f6fc/886446321981.jpg/600x600bb.jpg", album: "Faded - EP" },
        "Titanium|||David Guetta": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/d7/31/16/d7311629-4945-2c68-38ef-2ea808582d0e/mzaf_16661300875206508900.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/77/6f/57/776f57e2-017d-ed40-8f0f-1547beb65517/190296501425.jpg/600x600bb.jpg", album: "Titanium (feat. Sia)" },
        "Lean On|||Major Lazer": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview126/v4/cf/4f/9f/cf4f9f22-a272-72ae-6873-52a23afc0b98/mzaf_10354636981390731246.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/29/a7/3f/29a73f03-a1b5-c8f0-0df7-8dfe107bf929/653738300326_Cover.jpg/600x600bb.jpg", album: "Lean On - Single" },

        // ── Anime ──
        "Idol|||YOASOBI": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview126/v4/c4/66/2b/c4662bbf-877c-d684-5a1c-f47d1e01cbc8/mzaf_2094216344108530658.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/76/6e/ea/766eea0b-54bb-8860-80be-c2e4101520f4/198009311613.png/600x600bb.jpg", album: "Idol (From \"Oshi No Ko\") - Single" },
        "Racing Into The Night|||YOASOBI": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/0e/c1/c3/0ec1c306-abe6-9f29-2efb-ae5df908480d/mzaf_2757623543673456999.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/7f/8c/90/7f8c90dd-e11f-30d5-271d-4b72eee970bd/195497666737.jpg/600x600bb.jpg", album: "THE BOOK" },
        "Gurenge|||LiSA": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/5e/02/62/5e02620e-2f05-8e17-7acd-2e4a6c52561d/mzaf_15937890891823926671.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/af/b0/2e/afb02ed7-9e22-d584-79e4-565e65a03cdd/a7da7401-65ca-4a61-a47e-1d32b6e31e80.jpg/600x600bb.jpg", album: "Gurenge (From \"Demon Slayer\") - Single" },
        "Blue Bird|||Ikimonogakari": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/63/4b/b2/634bb252-1e58-37f8-449e-2f2f4340c021/mzaf_9221704373718497901.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/48/f2/f7/48f2f77a-1229-2f65-87da-5efa9dab85b1/886445760033.jpg/600x600bb.jpg", album: "Chou Ikimonobakari Members Best Selection" },
        "Silhouette|||KANA-BOON": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/31/76/a3/3176a3c8-0465-b1fb-9a06-faf9f2423fbc/mzaf_892689947062240155.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/7b/30/aa/7b30aa0a-0b3f-bb03-4dce-70840e227444/jacket_KSCL02520B00Z_550.jpg/600x600bb.jpg", album: "Silhouette - Single" },
        "unravel|||TK from Ling tosite sigure": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/5c/6c/a7/5c6ca766-8d69-cc32-e16f-9f6bb9ed405c/mzaf_871812147337318922.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music30/v4/8f/c4/17/8fc41796-ac5b-a7eb-1154-00ba82b9da95/859717459317_cover.jpg/600x600bb.jpg", album: "Unravel (Tokyo Ghoul) - Single" },
        "Kaikai Kitan|||Eve": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/e2/53/5b/e2535b6d-3df8-0a6b-e10f-ca7a8385e1c2/mzaf_6472539432382624207.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/a8/35/f8/a835f846-6439-ae7b-9a6a-caede340f120/194152659879.png/600x600bb.jpg", album: "Kaikai Kitan (From \"Jujutsu Kaisen\") - Single" },
        "KICK BACK|||Kenshi Yonezu": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview122/v4/68/66/b4/6866b432-63c1-1fc8-e46b-bc417070ed64/mzaf_6071731039862516488.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/15/32/da/1532da94-cc8b-6653-38c0-f537d34b6016/4547366595604.jpg/600x600bb.jpg", album: "KICK BACK - Single" },
        "Sparkle|||RADWIMPS": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/56/0f/14/560f1404-345d-d210-239b-3defefe3763f/mzaf_13852268595428667741.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/56/b3/8c/56b38c05-1728-402c-016c-c1e4b0635be8/4988031167618_cover.jpg/600x600bb.jpg", album: "Your Name." },
        "A Cruel Angel's Thesis|||Yoko Takahashi": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/58/a9/28/58a92819-4c5e-a96e-74cd-3a604de995b2/mzaf_7145370490049538188.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music/v4/5e/e9/62/5ee9621b-f174-38d0-fd96-12f3ee747fb7/eva_icon.jpg/600x600bb.jpg", album: "EVANGELION(8bit)" },
        "Crossing Field|||LiSA": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview113/v4/cb/cc/bd/cbccbd68-2247-9580-bc36-e3757debd116/mzaf_16869144394025933999.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music123/v4/5a/85/43/5a8543b0-927f-e344-f868-0d138532785d/872133060479.png/600x600bb.jpg", album: "Link Start - EP" },
        "The Rumbling|||SiM": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview116/v4/1f/9c/94/1f9c9488-e22b-37ee-0f87-11f8b8323c27/mzaf_4189924617030195397.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/7a/18/87/7a1887b2-5a4b-c3ca-255d-db8a65f43245/PCSP_03935_A.jpg/600x600bb.jpg", album: "The Rumbling - Single" },
        "Guren no Yumiya|||Linked Horizon": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/93/e3/f7/93e3f754-61f0-11ec-25f6-38fea3cc719b/mzaf_10699107844703231183.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music/v4/50/50/b3/5050b320-cd45-2ad7-b1b2-1b9b473d2475/PCSP_01397_itunes.png/600x600bb.jpg", album: "Guren no Yumiya (TV Size) - Single" },
        "Cha-La Head-Cha-La|||Hironobu Kageyama": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/01/40/a5/0140a510-8583-12da-8e78-f68e2b5cac5e/mzaf_14821378674353132090.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/21/26/02/212602c9-99ee-1dfe-b2f1-ef31a583cf71/artwork.jpg/600x600bb.jpg", album: "Cha-La Head-Cha-La (From Dragon Ball Z) - Single" },
        "Tank!|||Seatbelts": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/fa/41/04/fa41047a-2eba-7b11-1ca5-74bbbc709bd8/mzaf_11134654358432867890.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/5a/bb/df/5abbdf28-bf0e-0530-e5f8-0f0ca3150e0a/195081633657.jpg/600x600bb.jpg", album: "COWBOY BEBOP (Original Motion Picture Soundtrack)" },
        "Again|||YUI": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview123/v4/ce/ea/e5/ceeae580-7068-484e-9f67-d8bac12ec126/mzaf_3829322613576633382.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music123/v4/21/b8/a3/21b8a3a5-4374-3594-9ef3-294efc281e6a/840096168488.png/600x600bb.jpg", album: "Total Coverage, Vol. 1" },
        "Lilium|||Kumiko Noma": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/da/56/82/da5682e4-8e00-748b-72a0-442b08189349/mzaf_7278667656698679561.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/1b/50/11/1b501108-dcba-df32-59d6-8397a0f1a317/r4FzB.png/600x600bb.jpg", album: "Lilium (from Elfen Lied) - Single" },
        "Pretender|||Official HIGE DANdism": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/ce/0f/9c/ce0f9cf6-edfd-d964-317a-56781936a96b/mzaf_10158629645505453806.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/1f/b6/36/1fb6364f-77fc-7653-3750-811631832ee9/PCCA_04785.jpg/600x600bb.jpg", album: "Pretender - Single" },
        "Mixed Nuts|||Official HIGE DANdism": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/d9/08/63/d9086309-5e99-43c9-dece-8cf69b17e408/mzaf_16418685507341471716.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music113/v4/9c/7d/88/9c7d883d-4477-bf68-f56f-a726030a63a2/PCCA_04822.jpg/600x600bb.jpg", album: "Traveler" },
        "Zenzenzense|||RADWIMPS": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/f8/fd/9f/f8fd9f88-67e8-ce12-f44d-1b4fe421f1f9/mzaf_5313510550820503304.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/56/b3/8c/56b38c05-1728-402c-016c-c1e4b0635be8/4988031167618_cover.jpg/600x600bb.jpg", album: "Your Name." },

        // ── Hindi ──
        "Kesariya|||Arijit Singh": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/38/4c/5c/384c5c8f-3ff8-e457-b2f7-3158ce108649/mzaf_12389299033886433185.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/9f/13/ca/9f13ca3b-e533-03e0-f19a-f0aaa774581d/196589311191.jpg/600x600bb.jpg", album: "Kesariya (From \"Brahmastra\") - Single" },
        "Tum Hi Ho|||Arijit Singh": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/38/de/b9/38deb942-d44a-f2bb-205c-ddf05be84693/mzaf_9747647124859107103.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/bb/23/ee/bb23eeed-0c35-4f1d-2b11-485622777ae4/8902894353007_cover.jpg/600x600bb.jpg", album: "Aashiqui 2 (Original Motion Picture Soundtrack)" },
        "Channa Mereya|||Arijit Singh": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/d5/f9/98/d5f998a7-0090-ee2d-03f8-557ad6c5bf65/mzaf_14251357991592637728.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/bc/6e/4d/bc6e4d0c-adec-b431-7b60-16f5689f9664/886446201597.jpg/600x600bb.jpg", album: "Ae Dil Hai Mushkil (Original Motion Picture Soundtrack)" },
        "Senorita|||Farhan Akhtar": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/91/64/31/9164312f-07b4-0378-2174-823a12572f10/mzaf_7630635950642986007.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/b0/3f/4c/b03f4cca-8a6a-f506-4490-3263b4fb620c/8902894696296_cover.jpg/600x600bb.jpg", album: "Zindagi Na Milegi Dobara (Original Motion Picture Soundtrack)" },
        "Gerua|||Arijit Singh": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/bf/6e/24/bf6e24d8-d4d5-1cac-adc6-4a0fc07e98da/mzaf_14186979808495752044.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/dd/c8/ee/ddc8ee1d-baeb-0c8b-383f-1eb21bd172c2/886445593280.jpg/600x600bb.jpg", album: "Dilwale (Original Motion Picture Soundtrack)" },

        // ── Sports / Anthems ──
        "Waka Waka|||Shakira": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/98/88/e5/9888e55d-4daf-0e96-480b-a38259013586/mzaf_9048311608369053538.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/3e/3a/73/3e3a73da-e19e-b26c-ec19-9da6a5da93fa/mzi.ixhiugev.jpg/600x600bb.jpg", album: "Listen Up! The Official 2010 FIFA World Cup Album" },
        "We Are The Champions|||Queen": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/8c/b9/38/8cb93818-d1d3-7093-8679-5a42c261b429/mzaf_826149797423692231.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/4d/08/2a/4d082a9e-7898-1aa1-a02f-339810058d9e/14DMGIM05632.rgb.jpg/600x600bb.jpg", album: "Greatest Hits I, II & III: The Platinum Collection" },
        "We Will Rock You|||Queen": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/e9/37/42/e9374231-9cef-ad56-365c-a7ba09e4fa55/mzaf_10566507321838390251.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/4d/08/2a/4d082a9e-7898-1aa1-a02f-339810058d9e/14DMGIM05632.rgb.jpg/600x600bb.jpg", album: "Greatest Hits I, II & III: The Platinum Collection" },
        "Eye of the Tiger|||Survivor": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/fe/fa/9e/fefa9edd-c023-4d1c-1012-08bfb0ec69e6/mzaf_4651653238471209843.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/f9/02/8f/f9028f63-7a55-235e-f789-1e8946430fa2/614223201122.jpg/600x600bb.jpg", album: "Eye of the Tiger (Remastered)" },

        // ── Movie Themes ──
        "He's a Pirate|||Klaus Badelt": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/5e/14/f9/5e14f984-c6af-5dd4-e4ae-337d3a41ab31/mzaf_17811455529095579551.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/9a/0c/05/9a0c056b-9a6a-9446-5aa2-939aa2486ef3/00050086008971.rgb.jpg/600x600bb.jpg", album: "Pirates of the Caribbean: The Curse of the Black Pearl (Original Soundtrack)" },
        "Time|||Hans Zimmer": { previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/94/9c/89/949c8995-41f8-d3c1-90eb-81c10b54133b/mzaf_8252792899119007978.plus.aac.p.m4a", cover: "https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/9f/7e/60/9f7e6017-3bd3-570f-7890-eba0f3aa6c33/mzi.hxbvposl.jpg/600x600bb.jpg", album: "Inception (Music from the Motion Picture)" }
    };

    // seed: 由 (title, artist, category) 取 TRACK_DATA 元数据组装一条曲目（复刻源 seed()）
    const seed = (title, artist, category) => {
        const cached = TRACK_DATA[`${title}|||${artist}`];
        return {
            title,
            artist,
            category,
            cover: cached ? cached.cover : "",
            previewUrl: cached ? cached.previewUrl : undefined,
            album: cached ? cached.album : undefined
        };
    };

    // TRACKS：照搬源 nowPlaying.ts 的曲目列表与分类顺序
    const TRACKS = [
        // English Mix
        seed("Cradles", "Sub Urban", "English Mix"),
        seed("Blinding Lights", "The Weeknd", "English Mix"),
        seed("Levitating", "Dua Lipa", "English Mix"),
        seed("bad guy", "Billie Eilish", "English Mix"),
        seed("Viva La Vida", "Coldplay", "English Mix"),
        seed("Counting Stars", "OneRepublic", "English Mix"),
        seed("Shape of You", "Ed Sheeran", "English Mix"),
        seed("Uptown Funk", "Mark Ronson", "English Mix"),
        seed("Watermelon Sugar", "Harry Styles", "English Mix"),
        seed("Physical", "Dua Lipa", "English Mix"),
        seed("As It Was", "Harry Styles", "English Mix"),
        seed("Flowers", "Miley Cyrus", "English Mix"),
        seed("Anti-Hero", "Taylor Swift", "English Mix"),
        seed("Stay", "The Kid LAROI", "English Mix"),

        // Indie / Rock
        seed("Mr. Brightside", "The Killers", "Indie / Rock"),
        seed("Seven Nation Army", "The White Stripes", "Indie / Rock"),
        seed("Feel Good Inc.", "Gorillaz", "Indie / Rock"),
        seed("Believer", "Imagine Dragons", "Indie / Rock"),
        seed("Do I Wanna Know?", "Arctic Monkeys", "Indie / Rock"),
        seed("Bohemian Rhapsody", "Queen", "Indie / Rock"),
        seed("Somebody That I Used to Know", "Gotye", "Indie / Rock"),
        seed("Pumped Up Kicks", "Foster the People", "Indie / Rock"),

        // Hip-Hop
        seed("SICKO MODE", "Travis Scott", "Hip-Hop"),
        seed("HUMBLE.", "Kendrick Lamar", "Hip-Hop"),
        seed("God's Plan", "Drake", "Hip-Hop"),
        seed("Old Town Road", "Lil Nas X", "Hip-Hop"),
        seed("Without Me", "Eminem", "Hip-Hop"),

        // Electronic
        seed("Animals", "Martin Garrix", "Electronic"),
        seed("Wake Me Up", "Avicii", "Electronic"),
        seed("Faded", "Alan Walker", "Electronic"),
        seed("Titanium", "David Guetta", "Electronic"),
        seed("Lean On", "Major Lazer", "Electronic"),

        // Anime
        seed("Idol", "YOASOBI", "Anime"),
        seed("Racing Into The Night", "YOASOBI", "Anime"),
        seed("Gurenge", "LiSA", "Anime"),
        seed("Blue Bird", "Ikimonogakari", "Anime"),
        seed("Silhouette", "KANA-BOON", "Anime"),
        seed("unravel", "TK from Ling tosite sigure", "Anime"),
        seed("Kaikai Kitan", "Eve", "Anime"),
        seed("KICK BACK", "Kenshi Yonezu", "Anime"),
        seed("Sparkle", "RADWIMPS", "Anime"),
        seed("A Cruel Angel's Thesis", "Yoko Takahashi", "Anime"),
        seed("Crossing Field", "LiSA", "Anime"),
        seed("The Rumbling", "SiM", "Anime"),
        seed("Guren no Yumiya", "Linked Horizon", "Anime"),
        seed("Cha-La Head-Cha-La", "Hironobu Kageyama", "Anime"),
        seed("Tank!", "Seatbelts", "Anime"),
        seed("Again", "YUI", "Anime"),
        seed("Lilium", "Kumiko Noma", "Anime"),
        seed("Pretender", "Official HIGE DANdism", "Anime"),
        seed("Mixed Nuts", "Official HIGE DANdism", "Anime"),
        seed("Zenzenzense", "RADWIMPS", "Anime"),

        // Hindi
        seed("Kesariya", "Arijit Singh", "Hindi"),
        seed("Tum Hi Ho", "Arijit Singh", "Hindi"),
        seed("Channa Mereya", "Arijit Singh", "Hindi"),
        seed("Senorita", "Farhan Akhtar", "Hindi"),
        seed("Gerua", "Arijit Singh", "Hindi"),

        // Sports / Anthems
        seed("Waka Waka", "Shakira", "Sports / Anthems"),
        seed("We Are The Champions", "Queen", "Sports / Anthems"),
        seed("We Will Rock You", "Queen", "Sports / Anthems"),
        seed("Eye of the Tiger", "Survivor", "Sports / Anthems"),

        // Movie Themes
        seed("He's a Pirate", "Klaus Badelt", "Movie Themes"),
        seed("Time", "Hans Zimmer", "Movie Themes")
    ];

    // 分类顺序 + 歌单导航中文标签（复刻源 navPlaylists）
    const CATEGORIES = [
        "English Mix", "Anime", "Hindi", "Indie / Rock",
        "Hip-Hop", "Electronic", "Sports / Anthems", "Movie Themes"
    ];
    const PLAYLIST_LABEL = {
        "English Mix": "英文金曲",
        "Anime": "动漫歌曲",
        "Hindi": "印地语热歌",
        "Indie / Rock": "独立与摇滚",
        "Hip-Hop": "嘻哈说唱",
        "Electronic": "电子音乐",
        "Sports / Anthems": "运动战歌",
        "Movie Themes": "电影主题曲"
    };
    const VIEW_TITLE = {
        home: "主页",
        charts: "排行榜",
        songs: "歌曲",
        albums: "专辑",
        artists: "艺人",
        favorites: "喜爱的歌曲"
    };

    /* ===================================================================
     * 状态
     * =================================================================== */
    let currentIndex = -1; // TRACKS 中正在播放的索引
    let currentView = "home";
    let query = "";

    /* ---------- 独立 audio 实例（与其它播放器互不干扰） ---------- */
    const audio = new Audio();
    audio.preload = "metadata";
    audio.crossOrigin = "anonymous";
    audio.volume = 0.65;

    /* ---------- 生命周期：窗口移除时停止播放 + 解绑 ---------- */
    const ac = new AbortController();
    const on = (el, ev, fn, opts) =>
        el && el.addEventListener(ev, fn, { signal: ac.signal, ...(opts || {}) });

    const mo = new MutationObserver(() => {
        if (!document.body.contains(win)) {
            try { audio.pause(); audio.src = ""; } catch (e) { /* 忽略 */ }
            ac.abort();
            mo.disconnect();
        }
    });
    mo.observe(document.body, { childList: true });

    /* ---------- 元素 ---------- */
    const mainScroll = win.querySelector(".m2-main-scroll");
    const navItems = win.querySelectorAll('.m2-nav[data-group="library"] .m2-nav-item');
    const playlistNav = win.querySelector('.m2-nav[data-group="playlists"]');
    const searchInput = win.querySelector(".m2-search-input");

    const nowCover = win.querySelector(".m2-now-cover");
    const nowTitle = win.querySelector(".m2-now-title");
    const nowArtist = win.querySelector(".m2-now-artist");

    const playBtn = win.querySelector(".m2-play");
    const iconPlay = win.querySelector(".m2-icon-play");
    const iconPause = win.querySelector(".m2-icon-pause");
    const prevBtn = win.querySelector(".m2-prev");
    const nextBtn = win.querySelector(".m2-next");

    const seek = win.querySelector(".m2-seek");
    const curTimeEl = win.querySelector(".m2-time-cur");
    const durTimeEl = win.querySelector(".m2-time-dur");
    const volSlider = win.querySelector(".m2-vol");

    /* ===================================================================
     * 工具
     * =================================================================== */
    function escapeHTML(s) {
        return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[c]));
    }
    function fmtTime(sec) {
        if (!isFinite(sec) || sec < 0) sec = 0;
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s < 10 ? "0" : ""}${s}`;
    }
    // 给定一条 track 找回它在 TRACKS 中的原始索引（按 title+artist 唯一）
    function indexOfTrack(t) {
        return TRACKS.findIndex((x) => x.title === t.title && x.artist === t.artist);
    }
    function isActive(t) {
        return currentIndex >= 0 &&
            TRACKS[currentIndex].title === t.title &&
            TRACKS[currentIndex].artist === t.artist;
    }

    let toastTimer = null;
    function toast(msg) {
        let el = win.querySelector(".m2-toast");
        if (!el) {
            el = document.createElement("div");
            el.className = "m2-toast";
            win.appendChild(el);
        }
        el.textContent = msg;
        el.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
    }

    const favorites = new Set(); // 收藏（按 "title|||artist"）
    const favKey = (t) => `${t.title}|||${t.artist}`;

    /* ===================================================================
     * 过滤 + 分组聚合（复刻 AppleMusicApp.tsx 的 useMemo 逻辑）
     * =================================================================== */
    function filteredTracks() {
        const q = query.trim().toLowerCase();
        if (!q) return TRACKS.slice();
        return TRACKS.filter((t) =>
            [t.title, t.artist, t.album, t.category]
                .filter(Boolean).join(" ").toLowerCase().includes(q));
    }
    function byCategory(list, cat) {
        return list.filter((t) => t.category === cat);
    }
    // Featured：每个分类各取一首，再补足到 14（复刻 topPicks）
    function topPicks(list) {
        const out = [];
        CATEGORIES.forEach((c) => {
            const t = list.find((x) => x.category === c);
            if (t) out.push(t);
        });
        list.forEach((t) => { if (out.length < 14 && out.indexOf(t) < 0) out.push(t); });
        return out.slice(0, 14);
    }
    function chartsOf(list) {
        return list.slice().sort((a, b) => a.title.localeCompare(b.title)).slice(0, 20);
    }
    // artists：用 Map 真正按 artist 分组聚合（复刻源）
    function groupByArtist(list) {
        const map = new Map();
        list.forEach((t) => {
            const arr = map.get(t.artist) || [];
            arr.push(t);
            map.set(t.artist, arr);
        });
        return Array.from(map.entries()).map(([artist, l]) => ({ artist, list: l }));
    }
    // albums：用 Map 真正按 album 分组聚合（无 album 时退化为「title – Single」）
    function groupByAlbum(list) {
        const map = new Map();
        list.forEach((t) => {
            const a = t.album || `${t.title} – Single`;
            const arr = map.get(a) || [];
            arr.push(t);
            map.set(a, arr);
        });
        return Array.from(map.entries()).map(([album, l]) => ({ album, list: l }));
    }

    /* ===================================================================
     * 渲染：HTML 片段构造器
     * =================================================================== */
    function coverHTML(t, cls) {
        if (t.cover) {
            return `<img class="${cls}" src="${escapeHTML(t.cover)}" alt="${escapeHTML(t.title)}" loading="lazy" referrerpolicy="no-referrer" />`;
        }
        return `<div class="${cls} m2-cover-fallback"></div>`;
    }
    function dataAttr(t) {
        return `data-index="${indexOfTrack(t)}"`;
    }

    function headerHTML(title, sub, withPlay) {
        return `
        <div class="m2-header">
            <div class="m2-header-text">
                <h1 class="m2-h1">${escapeHTML(title)}</h1>
                <div class="m2-sub">${escapeHTML(sub)}</div>
            </div>
            ${withPlay ? `<button class="m2-play-pill" type="button" data-play-first="1">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7L8 5z"/></svg> 播放
            </button>` : ""}
        </div>`;
    }
    function sectionTitleHTML(text) {
        return `<div class="m2-section-title"><span>${escapeHTML(text)}</span><i class="m2-rule"></i></div>`;
    }
    function albumGridHTML(list) {
        const cells = list.map((t) => `
            <button class="m2-card" type="button" ${dataAttr(t)}>
                <div class="m2-card-art${isActive(t) ? " active" : ""}">${coverHTML(t, "m2-card-img")}</div>
                <div class="m2-card-cat">${escapeHTML(t.category || "")}</div>
                <div class="m2-card-title${isActive(t) ? " playing" : ""}">${escapeHTML(t.title)}</div>
                <div class="m2-card-artist">${escapeHTML(t.artist)}</div>
            </button>`).join("");
        return `<div class="m2-grid">${cells}</div>`;
    }
    function horizontalListHTML(list) {
        const cells = list.slice(0, 10).map((t) => `
            <button class="m2-htile${isActive(t) ? " active" : ""}" type="button" ${dataAttr(t)}>
                ${coverHTML(t, "m2-htile-img")}
                <div class="m2-htile-meta">
                    <div class="m2-htile-title${isActive(t) ? " playing" : ""}">${escapeHTML(t.title)}</div>
                    <div class="m2-htile-artist">${escapeHTML(t.artist)}</div>
                </div>
            </button>`).join("");
        return `<div class="m2-hgrid">${cells}</div>`;
    }
    function songTableHTML(list) {
        if (!list.length) {
            return `<div class="m2-table"><div class="m2-empty">未找到歌曲</div></div>`;
        }
        const rows = list.map((t, i) => `
            <button class="m2-row${isActive(t) ? " playing" : ""}" type="button" ${dataAttr(t)}>
                <span class="m2-row-idx">${isActive(t) ? "▶" : i + 1}</span>
                ${coverHTML(t, "m2-row-img")}
                <div class="m2-row-info">
                    <div class="m2-row-title${isActive(t) ? " playing" : ""}">${escapeHTML(t.title)}</div>
                    <div class="m2-row-artist">${escapeHTML(t.artist)}</div>
                </div>
                <div class="m2-row-album">${escapeHTML(t.album || t.category || "")}</div>
                <div class="m2-row-dur">0:30</div>
            </button>`).join("");
        return `<div class="m2-table">${rows}</div>`;
    }

    /* ===================================================================
     * 渲染：主区视图（复刻 AppleMusicApp.tsx 的 main 区分支）
     * =================================================================== */
    function render() {
        const list = filteredTracks();
        let html = "";

        if (currentView === "home") {
            const picks = topPicks(list);
            const charts = chartsOf(list);
            html += headerHTML("主页",
                list.length === 0 ? "资料库为空" : `${list.length} 首可播放预览 · ${CATEGORIES.length} 个精选歌单`,
                true);
            html += sectionTitleHTML("精选");
            html += albumGridHTML(picks);
            html += sectionTitleHTML("排行榜");
            html += albumGridHTML(charts.slice(0, 7));
            CATEGORIES.forEach((cat) => {
                const sub = byCategory(list, cat);
                if (!sub.length) return;
                html += sectionTitleHTML(PLAYLIST_LABEL[cat] || cat);
                html += horizontalListHTML(sub);
            });
        } else if (currentView === "charts") {
            const charts = chartsOf(list);
            html += headerHTML("排行榜", `${charts.length} 首热门`, true);
            html += songTableHTML(charts);
        } else if (currentView === "songs") {
            html += headerHTML("歌曲", `资料库中的 ${list.length} 首歌曲`, true);
            html += songTableHTML(list);
        } else if (currentView === "favorites") {
            const favs = list.filter((t) => favorites.has(favKey(t)));
            html += headerHTML("喜爱的歌曲", "你收藏的曲目", favs.length > 0);
            html += songTableHTML(favs);
        } else if (currentView === "artists") {
            const groups = groupByArtist(list);
            html += headerHTML("艺人", `${groups.length} 位艺人`, false);
            html += `<div class="m2-people">` + groups.map(({ artist, list: l }) => `
                <button class="m2-person" type="button" ${dataAttr(l[0])}>
                    <div class="m2-person-art">${coverHTML(l[0], "m2-person-img")}</div>
                    <div class="m2-person-name">${escapeHTML(artist)}</div>
                    <div class="m2-person-count">${l.length} 首</div>
                </button>`).join("") + `</div>`;
        } else if (currentView === "albums") {
            const groups = groupByAlbum(list);
            html += headerHTML("专辑", `${groups.length} 张专辑`, false);
            html += `<div class="m2-albums">` + groups.map(({ album, list: l }) => `
                <button class="m2-album" type="button" ${dataAttr(l[0])}>
                    <div class="m2-album-art">${coverHTML(l[0], "m2-album-img")}</div>
                    <div class="m2-album-title">${escapeHTML(album)}</div>
                    <div class="m2-album-meta">${escapeHTML(l[0].artist)} · ${l.length} 首</div>
                </button>`).join("") + `</div>`;
        } else if (CATEGORIES.indexOf(currentView) >= 0) {
            // 分类歌单视图（复刻 PlaylistView）
            const sub = byCategory(list, currentView);
            const label = PLAYLIST_LABEL[currentView] || currentView;
            html += `<div class="m2-playlist-hero">
                <div class="m2-playlist-cover">${sub[0] ? coverHTML(sub[0], "m2-playlist-img") : `<div class="m2-playlist-img m2-cover-fallback"></div>`}</div>
                <div class="m2-playlist-info">
                    <div class="m2-playlist-kicker">你的歌单</div>
                    <h1 class="m2-h1">${escapeHTML(label)}</h1>
                    <div class="m2-sub">${escapeHTML(label)} 精选 — 自动整理。</div>
                    <div class="m2-sub">${sub.length} 首 · 约 ${Math.round(sub.length * 0.5)} 分钟</div>
                    <button class="m2-play-pill" type="button" data-play-first="1">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7L8 5z"/></svg> 播放
                    </button>
                </div>
            </div>`;
            html += songTableHTML(sub);
        }

        mainScroll.innerHTML = html;
        mainScroll.scrollTop = 0;
        // 缓存当前视图首个可播放曲目索引，供 headerRow/hero 的「播放」按钮使用
        firstPlayable = firstPlayableForView(list);
    }

    let firstPlayable = -1;
    function firstPlayableForView(list) {
        let arr;
        if (currentView === "charts") arr = chartsOf(list);
        else if (currentView === "favorites") arr = list.filter((t) => favorites.has(favKey(t)));
        else if (CATEGORIES.indexOf(currentView) >= 0) arr = byCategory(list, currentView);
        else if (currentView === "home") arr = topPicks(list);
        else arr = list;
        for (const t of arr) {
            const idx = indexOfTrack(t);
            if (idx >= 0 && TRACKS[idx].previewUrl) return idx;
        }
        return -1;
    }

    /* ---------- 侧栏歌单导航渲染 ---------- */
    function renderPlaylistNav() {
        playlistNav.innerHTML = CATEGORIES.map((cat) => `
            <li class="m2-nav-item" data-view="${escapeHTML(cat)}">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true"><path d="M9 18V5l12-2v13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="18" r="3" stroke="currentColor" stroke-width="1.8"/><circle cx="18" cy="16" r="3" stroke="currentColor" stroke-width="1.8"/></svg>
                <span>${escapeHTML(PLAYLIST_LABEL[cat] || cat)}</span>
            </li>`).join("");
    }

    function syncNavActive() {
        win.querySelectorAll(".m2-nav-item").forEach((n) => {
            n.classList.toggle("active", n.dataset.view === currentView);
        });
    }

    /* ===================================================================
     * 底部「正在播放」+ 播放图标
     * =================================================================== */
    function renderNow() {
        const t = currentIndex >= 0 ? TRACKS[currentIndex] : null;
        if (t) {
            if (t.cover) {
                nowCover.style.backgroundImage = `url("${t.cover}")`;
                nowCover.classList.remove("m2-cover-fallback");
            } else {
                nowCover.style.backgroundImage = "";
                nowCover.classList.add("m2-cover-fallback");
            }
            nowTitle.textContent = t.title;
            nowArtist.textContent = t.artist;
        } else {
            nowCover.style.backgroundImage = "";
            nowCover.classList.add("m2-cover-fallback");
            nowTitle.textContent = "未在播放";
            nowArtist.textContent = "选择一首歌曲开始";
        }
    }
    function renderPlayIcon() {
        const playing = !audio.paused && currentIndex >= 0;
        // iconPlay/iconPause 是 <svg>(SVGElement),.hidden 属性不反射到内容属性,
        // 必须用 toggleAttribute 才能命中 [hidden]{display:none}(否则播放/暂停图标同时显示)。
        iconPlay.toggleAttribute("hidden", playing);
        iconPause.toggleAttribute("hidden", !playing);
        playBtn.setAttribute("aria-label", playing ? "暂停" : "播放");
    }

    /* ===================================================================
     * 播放控制（独立 audio 实例；next/prev 取模环绕）
     * =================================================================== */
    // 可播放曲目（有 previewUrl 的），用于 next/prev 环绕
    function playableList() {
        return TRACKS.map((t, i) => ({ t, i })).filter((x) => x.t.previewUrl);
    }
    function playablePos() {
        const list = playableList();
        const p = list.findIndex((x) => x.i === currentIndex);
        return p < 0 ? -1 : p;
    }

    function playTrack(index) {
        if (index < 0 || index >= TRACKS.length) return;
        const t = TRACKS[index];
        if (!t.previewUrl) {
            toast("该曲目暂无可播放的预览");
            return;
        }
        currentIndex = index;
        audio.src = t.previewUrl;
        seek.value = 0;
        curTimeEl.textContent = "0:00";
        durTimeEl.textContent = "0:30";
        const p = audio.play();
        if (p && typeof p.catch === "function") {
            p.catch(() => toast("无法播放音频，请检查网络连接"));
        }
        renderNow();
        renderPlayIcon();
        render();
        syncNavActive();
    }

    function togglePlay() {
        if (currentIndex < 0) {
            if (firstPlayable >= 0) playTrack(firstPlayable);
            else {
                const pl = playableList();
                if (pl.length) playTrack(pl[0].i);
            }
            return;
        }
        if (audio.paused) {
            const p = audio.play();
            if (p && typeof p.catch === "function") {
                p.catch(() => toast("无法播放音频，请检查网络连接"));
            }
        } else {
            audio.pause();
        }
        renderPlayIcon();
    }

    function step(delta) {
        const list = playableList();
        if (!list.length) return;
        let pos = playablePos();
        if (pos < 0) { playTrack(list[0].i); return; }
        pos = ((pos + delta) % list.length + list.length) % list.length;
        playTrack(list[pos].i);
    }

    /* ===================================================================
     * audio 事件
     * =================================================================== */
    let seeking = false;
    on(audio, "loadedmetadata", () => {
        durTimeEl.textContent = fmtTime(isFinite(audio.duration) ? audio.duration : 30);
    });
    on(audio, "timeupdate", () => {
        const dur = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 30;
        if (!seeking) seek.value = String(Math.round((audio.currentTime / dur) * 1000));
        curTimeEl.textContent = fmtTime(audio.currentTime);
    });
    on(audio, "ended", () => step(1));
    on(audio, "play", renderPlayIcon);
    on(audio, "pause", renderPlayIcon);
    on(audio, "error", () => {
        if (currentIndex >= 0) toast("音频加载失败，可能处于离线或跨域受限");
    });

    /* ===================================================================
     * 交互绑定
     * =================================================================== */
    // 主区点击委托：曲目卡片/行/专辑/艺人 -> 播放；「播放」胶囊 -> 播放当前视图首曲
    on(mainScroll, "click", (e) => {
        const playFirst = e.target.closest("[data-play-first]");
        if (playFirst) {
            if (firstPlayable >= 0) playTrack(firstPlayable);
            else toast("当前列表暂无可播放曲目");
            return;
        }
        const item = e.target.closest("[data-index]");
        if (!item) return;
        const idx = parseInt(item.dataset.index, 10);
        if (!isNaN(idx) && idx >= 0) playTrack(idx);
    });

    // 资料库导航
    navItems.forEach((item) => {
        on(item, "click", () => {
            currentView = item.dataset.view || "home";
            syncNavActive();
            render();
        });
    });
    // 歌单导航（委托）
    on(playlistNav, "click", (e) => {
        const item = e.target.closest(".m2-nav-item");
        if (!item) return;
        currentView = item.dataset.view || "home";
        syncNavActive();
        render();
    });

    // 搜索
    on(searchInput, "input", () => {
        query = searchInput.value || "";
        render();
    });

    on(playBtn, "click", togglePlay);
    on(prevBtn, "click", () => step(-1));
    on(nextBtn, "click", () => step(1));

    // 进度条 seek
    on(seek, "input", () => { seeking = true; });
    on(seek, "change", () => {
        const dur = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 30;
        audio.currentTime = (parseInt(seek.value, 10) / 1000) * dur;
        seeking = false;
    });

    // 音量
    on(volSlider, "input", () => {
        audio.volume = Math.max(0, Math.min(1, parseInt(volSlider.value, 10) / 100));
    });

    /* ===================================================================
     * 初始渲染
     * =================================================================== */
    renderPlaylistNav();
    render();
    renderNow();
    renderPlayIcon();
    syncNavActive();
})();
