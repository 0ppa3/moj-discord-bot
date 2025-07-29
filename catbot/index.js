// --- Potrzebne biblioteki ---
const {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const express = require('express');
const fetch = require('node-fetch');

// Zmienne środowiskowe z zakładki "Secrets"
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;

// --- Definicje i Rejestracja Komend ---
const commands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Sprawdza, czy bot działa (odpowiada "Pong!").'),
  new SlashCommandBuilder()
    .setName('info')
    .setDescription('Wyświetla zaawansowane informacje o serwerze.'),
  new SlashCommandBuilder()
    .setName('user')
    .setDescription('Wyświetla zaawansowane informacje o użytkowniku.')
    .addUserOption(option =>
      option.setName('uzytkownik')
      .setDescription('Użytkownik, o którym chcesz zobaczyć informacje.')
      .setRequired(false)),
  new SlashCommandBuilder()
    .setName('pomoc')
    .setDescription('Pokazuje listę wszystkich dostępnych komend.'),
  new SlashCommandBuilder()
    .setName('meme')
    .setDescription('Wyświetla losowego mema z internetu.')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('Rozpoczęto odświeżanie globalnych komend aplikacji (/).');
    await rest.put(
      Routes.applicationCommands(CLIENT_ID), { body: commands }
    );
    console.log('Pomyślnie przeładowano globalne komendy aplikacji (/).');
  } catch (error) {
    console.error('Błąd podczas rejestracji komend:', error);
  }
})();

// --- GŁÓWNA LOGIKA BOTA ---
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, () => {
  console.log(`Zalogowano jako ${client.user.tag}! Bot jest w pełni operacyjny.`);
});

// --- Główny Handler Interakcji (Komendy i Przyciski) ---
client.on(Events.InteractionCreate, async interaction => {
  // Obsługa komend Slash
  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;

    try {
      if (commandName === 'ping') {
        await interaction.reply('Pong!');
      }
      else if (commandName === 'pomoc') {
        const helpEmbed = new EmbedBuilder()
          .setColor('#0099ff')
          .setTitle('Lista moich komend')
          .setDescription('Oto co potrafię zrobić:')
          .addFields(
            { name: '`/ping`', value: 'Sprawdza, czy jestem online.' },
            { name: '`/info`', value: 'Wyświetla informacje o tym serwerze.' },
            { name: '`/user [użytkownik]`', value: 'Pokazuje info o Tobie lub kimś innym.' },
            { name: '`/meme`', value: 'Wysyła losowego mema.' }
          )
          .setTimestamp()
          .setFooter({ text: 'Miłego dnia!' });
        await interaction.reply({ embeds: [helpEmbed] });
      }
      else if (commandName === 'info') {
        const { guild } = interaction;
        const infoEmbed = new EmbedBuilder()
          .setColor('#f1c40f')
          .setTitle(`Informacje o serwerze ${guild.name}`)
          .setThumbnail(guild.iconURL({ dynamic: true }))
          .addFields(
            { name: 'Właściciel', value: `<@${guild.ownerId}>`, inline: true },
            { name: 'Liczba członków', value: `${guild.memberCount}`, inline: true },
            { name: 'Stworzono', value: guild.createdAt.toLocaleDateString("pl-PL"), inline: true }
          )
          .setTimestamp();
        await interaction.reply({ embeds: [infoEmbed] });
      }
      else if (commandName === 'user') {
        const user = interaction.options.getUser('uzytkownik') || interaction.user;
        const member = await interaction.guild.members.fetch(user.id);
        const userEmbed = new EmbedBuilder()
          .setColor('#e91e63')
          .setTitle(`Informacje o ${user.username}`)
          .setThumbnail(user.displayAvatarURL({ dynamic: true }))
          .addFields(
            { name: 'Tag Discord', value: `\`${user.tag}\``, inline: true },
            { name: 'ID użytkownika', value: `\`${user.id}\``, inline: true },
            { name: 'Dołączył do serwera', value: member.joinedAt.toLocaleDateString("pl-PL"), inline: false },
            { name: 'Konto stworzone', value: user.createdAt.toLocaleDateString("pl-PL"), inline: false }
          )
          .setTimestamp();
        await interaction.reply({ embeds: [userEmbed] });
      }
      else if (commandName === 'meme') {
        await interaction.deferReply();
        const response = await fetch('https://meme-api.com/gimme');
        const data = await response.json();

        const memeEmbed = new EmbedBuilder()
          .setColor('#ff9800')
          .setTitle(data.title)
          .setImage(data.url)
          .setFooter({ text: `Subreddit: r/${data.subreddit}` });

        const deleteButton = new ButtonBuilder()
          .setCustomId('delete_meme')
          .setLabel('Usuń mema')
          .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(deleteButton);

        await interaction.editReply({ embeds: [memeEmbed], components: [row] });
      }
    } catch (error) {
        console.error("Wystąpił błąd przy obsłudze komendy:", error);
        if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ content: 'Wystąpił błąd podczas wykonywania tej komendy!', ephemeral: true });
        } else {
            await interaction.reply({ content: 'Wystąpił błąd podczas wykonywania tej komendy!', ephemeral: true });
        }
    }
  }
  // Obsługa przycisków
  else if (interaction.isButton()) {
    if (interaction.customId === 'delete_meme') {
      try {
        await interaction.message.delete();
        // Opcjonalnie można wysłać potwierdzenie usunięcia, ale lepiej tego nie robić
        // await interaction.reply({ content: "Mem został usunięty.", ephemeral: true });
      } catch (error) {
        console.error("Nie udało się usunąć wiadomości:", error);
        await interaction.reply({ content: "Nie mogłem usunąć tej wiadomości (prawdopodobnie jest za stara lub nie mam uprawnień).", ephemeral: true });
      }
    }
  }
});


// --- SERWER WWW DLA HOSTINGU 24/7 ---
const app = express();
const port = 3000;
app.get('/', (req, res) => { res.send('Bot jest aktywny i gotowy do zaawansowanych zadań!'); });
app.listen(port, () => { console.log(`Serwer WWW nasłuchuje na porcie ${port}.`); });

// --- Logowanie bota ---
client.login(TOKEN);