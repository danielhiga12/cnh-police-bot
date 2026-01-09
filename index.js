const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const fs = require("fs");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
});

const PREFIX = "!";

// ===== CARGOS POLÍCIA =====
const POLICIA_CARGOS = ["Polícia", "Policial"];

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

// ===== DADOS =====
let cnhs = load("./data/cnhs.json");
let economia = load("./data/economia.json");
let multas = load("./data/multas.json");
let provas = load("./data/provas.json");

// ===== PERGUNTAS DETRAN =====
const perguntas = [
  { q: "Qual a velocidade máxima em via urbana?", a: "60" },
  { q: "Dirigir alcoolizado é infração?", a: "sim" },
  { q: "O cinto é obrigatório?", a: "sim" },
  { q: "Avançar sinal vermelho é permitido?", a: "não" },
  { q: "Celular ao volante é infração?", a: "sim" },
  { q: "Quem tem prioridade no cruzamento?", a: "direita" },
];

// ===== LOG POLÍCIA =====
function logPolicia(guild, policial, alvo, valor, pontos) {
  const canal = guild.channels.cache.find(c => c.name === "logs-policia");
  if (!canal) return;

  const embed = new EmbedBuilder()
    .setTitle("🚨 Multa Aplicada")
    .setColor("Red")
    .setDescription(
      `👮 **Policial:** ${policial.tag}
👤 **Multado:** ${alvo.tag}
💸 **Valor:** R$${valor}
📊 **Pontos:** ${pontos}`
    )
    .setTimestamp();

  canal.send({ embeds: [embed] });
}

// ===== READY =====
client.once("ready", () => {
  console.log(`✅ Bot CNH + Polícia online`);
});

// ===== COMANDOS =====
client.on("messageCreate", async (message) => {
  if (!message.content.startsWith(PREFIX) || message.author.bot) return;

  const args = message.content.slice(1).split(/ +/);
  const cmd = args.shift().toLowerCase();
  const user = message.mentions.users.first();

  economia[message.author.id] ??= { carteira: 10000 };

  // ===== TIRAR CNH =====
  if (cmd === "tirarcnh") {
    if (economia[message.author.id].carteira < 2000)
      return message.reply("❌ Você precisa de R$2000");

    economia[message.author.id].carteira -= 2000;
    provas[message.author.id] = { acertos: 0, atual: 0 };

    save("./data/economia.json", economia);
    save("./data/provas.json", provas);

    message.reply(
      `📝 Prova iniciada!\nPergunta 1:\n**${perguntas[0].q}**\nUse: !responder sua_resposta`
    );
  }

  // ===== RESPONDER PROVA =====
  if (cmd === "responder") {
    const prova = provas[message.author.id];
    if (!prova) return message.reply("❌ Você não iniciou a prova");

    const resposta = args.join(" ").toLowerCase();
    const pergunta = perguntas[prova.atual];

    if (resposta === pergunta.a) prova.acertos++;

    prova.atual++;

    if (prova.atual >= perguntas.length) {
      delete provas[message.author.id];
      save("./data/provas.json", provas);

      if (prova.acertos >= 4) {
        message.reply(
          `✅ Aprovado!\nEscolha categoria:\n!categoria B (R$5000)\n!categoria C (R$8000)`
        );
      } else {
        message.reply("❌ Reprovado. Pague novamente para refazer.");
      }
      return;
    }

    message.reply(
      `Pergunta ${prova.atual + 1}:\n**${perguntas[prova.atual].q}**`
    );
  }

  // ===== ESCOLHER CATEGORIA =====
  if (cmd === "categoria") {
    const cat = args[0]?.toUpperCase();
    const custo = cat === "B" ? 5000 : cat === "C" ? 8000 : 0;
    if (!custo) return;

    if (economia[message.author.id].carteira < custo)
      return message.reply("❌ Saldo insuficiente");

    economia[message.author.id].carteira -= custo;
    cnhs[message.author.id] = {
      categoria: cat,
      pontos: 20,
      status: "ATIVA",
      validade: Date.now() + 1000 * 60 * 60 * 24 * 30
    };

    save("./data/cnhs.json", cnhs);
    save("./data/economia.json", economia);

    message.reply(`🚗 CNH categoria ${cat} emitida com sucesso`);
  }

  // ===== VER CNH =====
  if (cmd === "vercnh") {
    const alvo = user || message.author;
    const cnh = cnhs[alvo.id];
    if (!cnh) return message.reply("❌ CNH não encontrada");

    const embed = new EmbedBuilder()
      .setTitle("🪪 CNH")
      .setColor("Blue")
      .setDescription(
        `👤 ${alvo.tag}
🚗 Categoria: ${cnh.categoria}
📊 Pontos: ${cnh.pontos}
📄 Status: ${cnh.status}`
      );

    message.channel.send({ embeds: [embed] });
  }

  // ===== RENOVAR CNH =====
  if (cmd === "renovarcnh") {
    const cnh = cnhs[message.author.id];
    if (!cnh) return message.reply("❌ Você não possui CNH");

    if (economia[message.author.id].carteira < 1500)
      return message.reply("❌ Precisa de R$1500");

    economia[message.author.id].carteira -= 1500;
    cnh.validade = Date.now() + 1000 * 60 * 60 * 24 * 30;
    cnh.pontos = 20;
    cnh.status = "ATIVA";

    save("./data/cnhs.json", cnhs);
    save("./data/economia.json", economia);

    message.reply("✅ CNH renovada com sucesso");
  }

  // ===== MULTA =====
  if (cmd === "multa") {
    if (!isPolicia(message.member)) return;

    const valor = Number(args[1]);
    const pontos = Number(args[2]);
    if (!user || !valor || !pontos) return;

    const cnh = cnhs[user.id];
    if (!cnh) return;

    cnh.pontos -= pontos;
    if (cnh.pontos <= 0) cnh.status = "SUSPENSA";

    multas[user.id] ??= [];
    multas[user.id].push({
      policial: message.author.tag,
      valor,
      pontos,
      data: new Date().toLocaleString()
    });

    save("./data/cnhs.json", cnhs);
    save("./data/multas.json", multas);

    logPolicia(message.guild, message.author, user, valor, pontos);
    message.reply("🚨 Multa aplicada");
  }

  // ===== HISTÓRICO =====
  if (cmd === "historicomultas") {
    if (!isPolicia(message.member)) return;

    const hist = multas[user?.id];
    if (!hist) return message.reply("Sem multas");

    const lista = hist.map(
      (m, i) =>
        `${i + 1}. 💸 R$${m.valor} | 📊 ${m.pontos} pts\n👮 ${m.policial}`
    ).join("\n\n");

    const embed = new EmbedBuilder()
      .setTitle("🧾 Histórico de Multas")
      .setColor("Orange")
      .setDescription(lista);

    message.channel.send({ embeds: [embed] });
  }

  // ===== SET / REMOVER CNH =====
  if (cmd === "setcnh") {
    if (!isPolicia(message.member)) return;
    const cat = args[1]?.toUpperCase();
    if (!["B", "C"].includes(cat)) return;

    cnhs[user.id] = {
      categoria: cat,
      pontos: 20,
      status: "ATIVA",
      validade: Date.now() + 1000 * 60 * 60 * 24 * 30
    };
    save("./data/cnhs.json", cnhs);
    message.reply("✅ CNH setada");
  }

  if (cmd === "removercnh") {
    if (!isPolicia(message.member)) return;
    delete cnhs[user.id];
    save("./data/cnhs.json", cnhs);
    message.reply("🗑️ CNH removida");
  }
});

client.login(process.env.TOKEN);
