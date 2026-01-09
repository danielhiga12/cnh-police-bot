const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const fs = require("fs");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const PREFIX = "!";

// ===== CARGOS =====
const POLICIA_CARGOS = ["Polícia", "Policial", "PM"];

// ===== FUNÇÕES =====
function load(file) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, "{}");
  return JSON.parse(fs.readFileSync(file));
}
function save(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
function isPolicia(member) {
  return member.roles.cache.some(r => POLICIA_CARGOS.includes(r.name));
}
function logPolicia(guild, titulo, descricao) {
  const canal = guild.channels.cache.find(c => c.name === "logs-policia");
  if (!canal) return;

  const embed = new EmbedBuilder()
    .setTitle(titulo)
    .setDescription(descricao)
    .setColor("Red")
    .setTimestamp();

  canal.send({ embeds: [embed] });
}

// ===== DADOS =====
let cnhs = load("./data/cnhs.json");
let economia = load("./data/economia.json");

// ===== READY =====
client.once("ready", () => {
  console.log(`🚓 Bot CNH + Polícia online: ${client.user.tag}`);
});

// ===== COMANDOS =====
client.on("messageCreate", async (message) => {
  if (!message.content.startsWith(PREFIX) || message.author.bot) return;

  const args = message.content.slice(1).trim().split(/ +/g);
  const cmd = args.shift().toLowerCase();
  const user = message.mentions.users.first();

  economia[message.author.id] ??= { carteira: 0 };

  // ===== VER CNH =====
  if (cmd === "vercnh") {
    const cnh = cnhs[message.author.id];
    if (!cnh) return message.reply("❌ Você não possui CNH.");

    const embed = new EmbedBuilder()
      .setTitle("🚗 Carteira Nacional de Habilitação")
      .setColor("Blue")
      .setDescription(
        `📘 Categoria: **${cnh.categoria}**
📊 Pontos: **${cnh.pontos}/20**
📅 Validade: **${cnh.validade}**
⚠️ Status: **${cnh.status}**`
      );

    message.channel.send({ embeds: [embed] });
  }

  // ===== TIRAR CNH =====
  if (cmd === "tirarcnh") {
    if (cnhs[message.author.id])
      return message.reply("❌ Você já possui CNH.");

    if (economia[message.author.id].carteira < 2000)
      return message.reply("❌ Você precisa de R$2000 para iniciar.");

    economia[message.author.id].carteira -= 2000;

    const perguntas = [
      { p: "Velocidade máxima em via urbana?", r: "50" },
      { p: "Placa vermelha significa?", r: "pare" },
      { p: "Dirigir bêbado é crime?", r: "sim" },
      { p: "Cinto é obrigatório?", r: "sim" },
      { p: "Ultrapassar em faixa contínua pode?", r: "nao" },
      { p: "Pedestre tem preferência?", r: "sim" },
    ];

    let acertos = 0;

    message.reply("📘 **Prova da CNH iniciada. Responda no chat.**");

    for (const q of perguntas) {
      await message.channel.send(`❓ ${q.p}`);

      const coletor = await message.channel.awaitMessages({
        filter: m => m.author.id === message.author.id,
        max: 1,
        time: 15000,
      });

      if (!coletor.size) continue;
      if (coletor.first().content.toLowerCase().includes(q.r)) acertos++;
    }

    if (acertos < 4) {
      save("./data/economia.json", economia);
      return message.reply(`❌ Reprovado (${acertos}/6). Refaça pagando novamente.`);
    }

    message.reply(
      "✅ **Aprovado!** Escolha:\n`!categoriab` (R$5000)\n`!categoriac` (R$8000)"
    );

    cnhs[message.author.id] = { pendente: true };
  }

  // ===== CATEGORIA B =====
  if (cmd === "categoriab") {
    if (!cnhs[message.author.id]?.pendente)
      return message.reply("❌ Nenhuma prova aprovada.");

    if (economia[message.author.id].carteira < 5000)
      return message.reply("❌ Saldo insuficiente.");

    economia[message.author.id].carteira -= 5000;

    cnhs[message.author.id] = {
      categoria: "B",
      pontos: 0,
      status: "ATIVA",
      validade: "31/12/2026",
      historico: [],
    };

    save("./data/cnhs.json", cnhs);
    save("./data/economia.json", economia);

    message.reply("🚗 CNH categoria **B** emitida!");
  }

  // ===== CATEGORIA C =====
  if (cmd === "categoriac") {
    if (!cnhs[message.author.id]?.pendente)
      return message.reply("❌ Nenhuma prova aprovada.");

    if (economia[message.author.id].carteira < 8000)
      return message.reply("❌ Saldo insuficiente.");

    economia[message.author.id].carteira -= 8000;

    cnhs[message.author.id] = {
      categoria: "C",
      pontos: 0,
      status: "ATIVA",
      validade: "31/12/2026",
      historico: [],
    };

    save("./data/cnhs.json", cnhs);
    save("./data/economia.json", economia);

    message.reply("🚛 CNH categoria **C** emitida!");
  }

  // ===== RENOVAR CNH =====
  if (cmd === "renovarcnh") {
    const cnh = cnhs[message.author.id];
    if (!cnh) return message.reply("❌ Você não possui CNH.");

    if (economia[message.author.id].carteira < 2000)
      return message.reply("❌ Saldo insuficiente.");

    economia[message.author.id].carteira -= 2000;
    cnh.validade = "31/12/2028";

    save("./data/cnhs.json", cnhs);
    save("./data/economia.json", economia);

    message.reply("🔄 CNH renovada com sucesso!");
  }

  // ===== MULTAR =====
  if (cmd === "multar") {
    if (!isPolicia(message.member))
      return message.reply("❌ Apenas a polícia.");

    if (!user) return message.reply("❌ Marque um usuário.");

    const pontos = Number(args[1]);
    if (!pontos) return message.reply("❌ Informe os pontos.");

    const cnh = cnhs[user.id];
    if (!cnh) return message.reply("❌ CNH não encontrada.");

    cnh.pontos += pontos;
    cnh.historico.push({
      pontos,
      data: new Date().toLocaleDateString(),
    });

    if (cnh.pontos >= 20) {
      cnh.status = "CASSADA";
    }

    save("./data/cnhs.json", cnhs);

    logPolicia(
      message.guild,
      "🚨 Multa Aplicada",
      `👤 ${user.tag}\n📊 Pontos: ${pontos}\n👮 ${message.author.tag}`
    );

    message.reply("🚨 Multa registrada.");
  }

  // ===== CASSAR CNH =====
  if (cmd === "cassarcnh") {
    if (!isPolicia(message.member))
      return message.reply("❌ Apenas a polícia.");

    if (!user) return message.reply("❌ Marque um usuário.");

    const cnh = cnhs[user.id];
    if (!cnh) return message.reply("❌ CNH não encontrada.");

    cnh.status = "CASSADA";
    cnh.pontos = 20;

    save("./data/cnhs.json", cnhs);

    message.reply("⛔ CNH cassada.");
  }

  // ===== REMOVER CNH =====
  if (cmd === "removercnh") {
    if (!isPolicia(message.member))
      return message.reply("❌ Apenas a polícia.");

    if (!user) return message.reply("❌ Marque um usuário.");

    delete cnhs[user.id];
    save("./data/cnhs.json", cnhs);

    message.reply("🧹 CNH removida.");
  }
});

client.login(process.env.TOKEN);
