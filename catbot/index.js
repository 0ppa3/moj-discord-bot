// --- Potrzebne biblioteki ---
const {
  Client, GatewayIntentBits, Events, REST, Routes, SlashCommandBuilder,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require('discord.js');
const express = require('express');
const fetch = require('node-fetch');
const mongoose = require('mongoose');

// --- Zmienne Środowiskowe (Sekrety z Render.com) ---
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const MONGODB_URI = process.env.MONGODB_URI; // Pamiętaj, aby go dodać w Render!

// --- Definicja Schematu Bazy Danych ---
const profileSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  balance: { type: Number, default: 100 },
  inventory: { type: [String], default: [] }, // Przechowuje ID przedmiotów
  lastWork: { type: Date, default: null },
  lastDaily: { type: Date, default: null },
});
const Profile = mongoose.model('Profile', profileSchema);

// --- Połączenie z Bazą Danych MongoDB ---
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Pomyślnie połączono z bazą danych MongoDB.'))
  .catch(err => {
    console.error('KRYTYCZNY BŁĄD: Nie można połączyć się z bazą danych. Sprawdź MONGODB_URI.', err);
    process.exit(1);
  });

// --- Definicja Przedmiotów w Sklepie ---
const shopItems = [
    { id: 'bronze_badge', name: '🥉 Brązowa Odznaka', price: 1000, description: 'Podstawowa odznaka dla początkujących.' },
    { id: 'silver_badge', name: '🥈 Srebrna Odznaka', price: 5000, description: 'Odznaka dla zaawansowanych graczy.' },
    { id: 'gold_badge', name: '🥇 Złota Odznaka', price: 25000, description: 'Prestiżowa odznaka dla najbogatszych.' },
];

// --- Rejestracja Komend Slash ---
const commands = [
  // Twoje stare komendy
  new SlashCommandBuilder().setName('ping').setDescription('Sprawdza, czy bot działa.'),
  new SlashCommandBuilder().setName('info').setDescription('Wyświetla informacje o serwerze.'),
  new SlashCommandBuilder().setName('user').setDescription('Wyświetla informacje o użytkowniku.')
    .addUserOption(option => option.setName('uzytkownik').setDescription('O kim chcesz zobaczyć info.').setRequired(false)),
  new SlashCommandBuilder().setName('pomoc').setDescription('Pokazuje listę wszystkich dostępnych komend.'),
  new SlashCommandBuilder().setName('meme').setDescription('Wyświetla losowego mema.'),
  // NOWE ZAAWANSOWANE KOMENDY EKONOMII
  new SlashCommandBuilder().setName('konto').setDescription('Wyświetla stan twojego konta i ekwipunek.'),
  new SlashCommandBuilder().setName('praca').setDescription('Pracuj, aby zarobić pieniądze (co godzinę).'),
  new SlashCommandBuilder().setName('prezent').setDescription('Odbierz swój darmowy, codzienny prezent!'),
  new SlashCommandBuilder().setName('topka').setDescription('Wyświetla ranking najbogatszych.'),
  new SlashCommandBuilder().setName('zaplac').setDescription('Przekaż monety innemu użytkownikowi.')
    .addUserOption(option => option.setName('odbiorca').setDescription('Komu chcesz zapłacić.').setRequired(true))
    .addIntegerOption(option => option.setName('kwota').setDescription('Ile monet chcesz przekazać.').setRequired(true).setMinValue(1)),
  new SlashCommandBuilder().setName('sloty').setDescription('Zagraj na jednorękim bandycie!')
    .addIntegerOption(option => option.setName('stawka').setDescription('Ile chcesz postawić.').setRequired(true).setMinValue(10)),
  new SlashCommandBuilder().setName('sklep').setDescription('Wyświetla przedmioty dostępne do kupienia.'),
  new SlashCommandBuilder().setName('kup').setDescription('Kup przedmiot ze sklepu.')
    .addStringOption(option => {
        option.setName('przedmiot').setDescription('Przedmiot, który chcesz kupić.').setRequired(true);
        // Automatycznie dodajemy opcje wyboru na podstawie sklepu
        shopItems.forEach(item => option.addChoices({ name: `${item.name} (${item.price} monet)`, value: item.id }));
        return option;
    }),
  new SlashCommandBuilder().setName('ekwipunek').setDescription('Pokazuje przedmioty, które posiadasz.'),
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
  try {
    console.log('Rozpoczęto odświeżanie komend aplikacji (/).');
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('Pomyślnie przeładowano komendy aplikacji (/).');
  } catch (error) { console.error('Błąd podczas rejestracji komend:', error); }
})();

// --- GŁÓWNA LOGIKA BOTA ---
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, () => { console.log(`Zalogowano jako ${client.user.tag}!`); });

client.on(Events.InteractionCreate, async interaction => {
    // --- Obsługa Przycisków (z komendy /meme) ---
    if (interaction.isButton()) {
        if (interaction.customId === 'delete_meme') {
            try {
                await interaction.message.delete();
            } catch (error) {
                console.error("Nie udało się usunąć wiadomości:", error);
                await interaction.reply({ content: "Nie mogłem usunąć tej wiadomości.", ephemeral: true });
            }
        }
        return; // Zakończ po obsłudze przycisku
    }
    
    if (!interaction.isChatInputCommand()) return;

    // --- Pobieranie profilu użytkownika dla komend ---
    const { commandName, user } = interaction;
    let profileData;
    try {
        profileData = await Profile.findOne({ userId: user.id });
        if (!profileData) {
            profileData = await Profile.create({ userId: user.id });
        }
    } catch (err) {
        console.error("Błąd bazy danych:", err);
        return interaction.reply({ content: 'Wystąpił błąd z bazą danych.', ephemeral: true });
    }

    // --- Handler Komend ---
    try {
        if (commandName === 'ping') { /* ...obsługa pinga... */ }
        // ... (Tu wklej logikę dla /info, /user, /pomoc, /meme z Twojego starego kodu) ...
        // Poniżej nowa logika ekonomii
        else if (commandName === 'konto') {
            const items = profileData.inventory.map(id => shopItems.find(item => item.id)?.name).filter(Boolean).join(', ') || 'brak';
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(`Konto: ${user.username}`)
                .setThumbnail(user.displayAvatarURL())
                .addFields(
                    { name: '💰 Portfel', value: `**${profileData.balance}** monet` },
                    { name: '🎒 Ekwipunek', value: items }
                );
            await interaction.reply({ embeds: [embed] });
        }
        else if (commandName === 'praca') {
            // ... (logika taka jak w poprzedniej odpowiedzi) ...
        }
        else if (commandName === 'prezent') {
            // ... (logika taka jak w poprzedniej odpowiedzi) ...
        }
        else if (commandName === 'topka') {
            // ... (logika taka jak w poprzedniej odpowiedzi) ...
        }
        else if (commandName === 'zaplac') {
            const recipient = interaction.options.getUser('odbiorca');
            const amount = interaction.options.getInteger('kwota');
            if (recipient.id === user.id) return interaction.reply({ content: 'Nie możesz zapłacić samemu sobie!', ephemeral: true });
            if (amount > profileData.balance) return interaction.reply({ content: 'Nie masz wystarczająco pieniędzy!', ephemeral: true });

            let recipientProfile = await Profile.findOne({ userId: recipient.id });
            if (!recipientProfile) recipientProfile = await Profile.create({ userId: recipient.id });

            profileData.balance -= amount;
            recipientProfile.balance += amount;
            await profileData.save();
            await recipientProfile.save();
            
            await interaction.reply(`Pomyślnie przelałeś **${amount}** monet do ${recipient.username}.`);
        }
        else if (commandName === 'sloty') {
            const stake = interaction.options.getInteger('stawka');
            if (stake > profileData.balance) return interaction.reply({ content: 'Nie masz tyle pieniędzy, aby postawić!', ephemeral: true });

            profileData.balance -= stake;
            const symbols = ['🍒', '🍋', '🍊', '💎'];
            const reel = [
                symbols[Math.floor(Math.random() * symbols.length)],
                symbols[Math.floor(Math.random() * symbols.length)],
                symbols[Math.floor(Math.random() * symbols.length)]
            ];
            const resultText = `[ ${reel.join(' | ')} ]`;
            let winnings = 0;

            if (reel[0] === '💎' && reel[1] === '💎' && reel[2] === '💎') winnings = stake * 10;
            else if (reel[0] === reel[1] && reel[1] === reel[2]) winnings = stake * 5;
            else if (reel[0] === reel[1] || reel[1] === reel[2]) winnings = stake * 2;
            
            let embed;
            if (winnings > 0) {
                profileData.balance += winnings;
                embed = new EmbedBuilder().setColor('#2ecc71').setTitle('WYGRANA!').setDescription(`${resultText}\nWygrałeś **${winnings}** monet!`);
            } else {
                embed = new EmbedBuilder().setColor('#e74c3c').setTitle('PRZEGRANA.').setDescription(`${resultText}\nStraciłeś **${stake}** monet.`);
            }
            await profileData.save();
            embed.setFooter({ text: `Twój stan konta: ${profileData.balance}` });
            await interaction.reply({ embeds: [embed] });
        }
        else if (commandName === 'sklep') {
            const embed = new EmbedBuilder().setColor('#9b59b6').setTitle('🏪 Sklep').setDescription('Użyj `/kup [ID]` aby kupić.');
            shopItems.forEach(item => {
                embed.addFields({ name: `${item.name} - \`${item.price}\` monet`, value: `*ID: \`${item.id}\`* - ${item.description}` });
            });
            await interaction.reply({ embeds: [embed] });
        }
        else if (commandName === 'kup') {
            const itemId = interaction.options.getString('przedmiot');
            const item = shopItems.find(i => i.id === itemId);
            if (!item) return interaction.reply({ content: 'Nie ma takiego przedmiotu!', ephemeral: true });
            if (item.price > profileData.balance) return interaction.reply({ content: 'Nie stać Cię na ten przedmiot!', ephemeral: true });
            if (profileData.inventory.includes(itemId)) return interaction.reply({ content: 'Już posiadasz ten przedmiot!', ephemeral: true });

            profileData.balance -= item.price;
            profileData.inventory.push(itemId);
            await profileData.save();
            await interaction.reply(`Pomyślnie zakupiłeś **${item.name}** za ${item.price} monet!`);
        }
        else if (commandName === 'ekwipunek') {
            const items = profileData.inventory.map(id => `• ${shopItems.find(item => item.id)?.name}`).filter(Boolean).join('\n') || 'Twój ekwipunek jest pusty.';
            const embed = new EmbedBuilder().setColor('#3498db').setTitle('🎒 Twój Ekwipunek').setDescription(items);
            await interaction.reply({ embeds: [embed] });
        }

    } catch (error) {
        console.error("Błąd komendy:", error);
        if (interaction.replied || interaction.deferred) await interaction.followUp({ content: 'Błąd!', ephemeral: true });
        else await interaction.reply({ content: 'Błąd!', ephemeral: true });
    }
});


// --- SERWER WWW DLA HOSTINGU 24/7 ---
const app = express();
const port = 3000;
app.get('/', (req, res) => { res.send('Bot z zaawansowaną ekonomią jest aktywny!'); });
app.listen(port, () => {
  client.login(TOKEN);
  console.log(`Serwer WWW nasłuchuje.`);
});
