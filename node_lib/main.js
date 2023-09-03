// Setup, loading libraries and initial config
const fs = require('fs')
const fsPromises = require('fs').promises
// const fsExists = require('fs.promises.exists')
bot_sys_cfg = "./node_lib/dotenv.txt"
const config = fs.existsSync(bot_sys_cfg) ? require('dotenv').config({ path:bot_sys_cfg}).parsed : require('dotenv').config().parsed

if (!config||!config.gpu_server_url||!config.gpu_data_io_path||!config.bot_data_io_path||!config.gpu_data_io_url_path||
    !config.channelID||!config.adminID||!config.discordBotKey||!config.gpu_data_io_url_path) { 
      throw('Please re-read the setup instructions at https://github.com/ausbitbank/stable-diffusion-discord-bot , \
        you are missing the required .env configuration file or options') 
}
const Eris = require("eris")
const Constants = Eris.Constants
const Collection = Eris.Collection
const axios = require('axios')
var parseArgs = require('minimist')
const chokidar = require('chokidar')
const moment = require('moment')
const dJSON = require('dirty-json')
var colors = require('colors')
// const debounce = require('debounce')
const FormData = require('form-data')
const io = require("socket.io-client")
const sio = io(config.gpu_server_url,{reconnect: true})
console.log("GPU URL ", config.gpu_server_url)

// Library imports
const utils = require('./utils.js')(config)
const db = require("./db.js")(utils, config.database_path)

// Shutdown gracefully
var signals = {'SIGHUP': 1,'SIGINT': 2,'SIGTERM': 15}
Object.keys(signals).forEach((signal)=>{
  process.on(signal, () =>{
    utils.log('Bye! ('+signal+' '+signals[signal]+')')
    process.exit(128+signals[signal])
  })
})


const bot = new Eris.CommandClient(config.discordBotKey, {
  intents: ["guilds", "guildMessages", "messageContent", "directMessages", "guildMessageReactions", "directMessageReactions"],
  description: config.botDescription||"JasPlay3D: Ad generation framework ",
  owner: config.botOwner||"jazzy",
  prefix: "!",
  reconnect: 'auto',
  compress: true,
  getAllUsers: false,
  maxShards: 'auto'
})
const payment = require("./payment.js")(utils, db, bot, config)
const pipe_api = require("./pipeline/pipe_api.js")(utils, db, sio, payment, bot)

// load our own font list from config
var fonts = config.fonts ? config.fonts.split(',') : ['Arial','Comic Sans MS','Tahoma','Times New Roman','Verdana','Lucida Console']
var fontsSlashCmd = []
fonts.forEach((f)=>{fontsSlashCmd.push({name: f,value: f})})

// UI State Machine
var paused = false
var rendering = false
var dialogs = {queue: null} // Track and replace our own messages to reduce spam

// Initialize the databse
db.dbRead()

function extract_user_info_frm_slash_cmd(i){
  // get attachments
  if (i.data.resolved && i.data.resolved.attachments && i.data.resolved.attachments.find(a=>a.contentType.startsWith('image/'))){
    var attachmentOrig=i.data.resolved.attachments.find(a=>a.contentType.startsWith('image/'))
    var attachment=[{width:attachmentOrig.width,height:attachmentOrig.height,size:attachmentOrig.size, 
      proxy_url:attachmentOrig.proxyUrl,content_type:attachmentOrig.contentType,filename:attachmentOrig.filename,
      id:attachmentOrig.id}]
  }else{var attachment=[]}

  if(i.member){
    var user_info = {userID:i.member.id, username:i.member.user.username, bot:i.member.user.bot}
  }else{
    var user_info = {userID:i.user.id, username:i.user.username, bot:i.user.bot}
  }
  user_info['guildid'] = i.guildID?i.guildID:undefined,
  user_info['channelid'] = i.channel.id
  user_info['attachments'] = attachment
  return user_info
}

// slash command setup - beware discord global limitations on the size/amount of slash command options
var slashCommands = [
  {
    name: 'jp3_gen_ad',
    description: 'Dream ur ad video',
    options: [
      {type: 3, name: 'ad_template', description: 'Choose the pipeline to guide ur creation', required: true, min_length: 1, max_length:1500 },
      {type: 3, name: 'ad_theme', description: 'Choose the overall theme of the ad', required: true, min_length: 1, max_length:1500 },
      {type: 3, name: 'fg_prompt', description: 'FG prompt for the 1st scene', required: true, min_length: 1, max_length:1500 },
      {type: 3, name: 'bg_prompt', description: 'BG prompt for the 1st scene', required: true, min_length: 1, max_length:1500 },
      {type: 4, name: 'num_options', description: 'Number of options to generate for the ist scene', required: false, min_value: 1, max_value: 4 },
    ],
    cooldown: 500,
    execute: (i) => {
      user_info = extract_user_info_frm_slash_cmd(i)
      // utils.log(user_info)
      pipe_state = pipe_api.validate_user_input(i.data.options, user_info)
      if(pipe_state === None){ // If pipe_state is not initialized
      }
      pipe_api.execute_job_stage(pipe_state, ui_input, user_info)

      var msg='<@'+user_info.userID+'> you have `'+100+'` :coin:'
      bot.createMessage(user_info.channelid, msg).then().catch(err=>{utils.log(err)})

    }
  },
  {
    name: 'help',
    description: 'Learn how to use this bot',
    cooldown: 500,
    execute: (i) => {
      help(i.channel.id)
    }
  },
]
// If credits are active, add /recharge and /balance otherwise don't include them
if(!config.creditsDisabled)
{
  slashCommands.push({
    name: 'recharge',
    description: 'Recharge your render credits with Hive, HBD or Bitcoin over lightning network',
    cooldown: 500,
    execute: (i) => {
      if (i.member) {payment.rechargePrompt(i.member.id,i.channel.id)} 
      else if (i.user){payment.rechargePrompt(i.user.id,i.channel.id)}}
  })
  slashCommands.push({
    name: 'balance',
    description: 'Check your credit balance',
    cooldown: 500,
    execute: (i) => {var userid=i.member?i.member.id:i.user.id;balancePrompt(userid,i.channel.id)}
  })
}

function authorised(who,channel,guild) {
  if (userid===config.adminID){return true} // always allow admin
  var bannedUsers=[];var allowedGuilds=[];var allowedChannels=[];var ignoredChannels=[];var userid=null;var username=null
  if (who.user && who.user.id && who.user.username){userid = who.user.id;username = who.user.username} else {userid=who.author.id;username=who.author.username}
  if (config.bannedUsers.length>0){bannedUsers=config.bannedUsers.split(',')}
  if (config.allowedGuilds.length>0){allowedGuilds=config.allowedGuilds.split(',')}
  if (config.allowedChannels.length>0){allowedChannels=config.allowedChannels.split(',')}
  if (config.ignoredChannels.length>0){ignoredChannels=config.ignoredChannels.split(',')}
  if (bannedUsers.includes(userid)){
    log('auth fail, user is banned:'+username);return false
  } else if(guild && allowedGuilds.length>0 && !allowedGuilds.includes(guild)){
    log('auth fail by '+username+', guild not allowed:'+guild);return false
  } else if(channel && allowedChannels.length>0 && !allowedChannels.includes(channel)){
    log('auth fail by '+username+', channel not allowed:'+channel);return false
  } else if (channel && ignoredChannels.length>0 && ignoredChannels.includes(channel)){
    log('auth fail by '+username+', channel is ignored:'+channel);return false
  } else { return true }
}

// Initial discord bot setup and listeners
bot.on("ready", async () => {
  utils.log("Connected to discord".bgGreen)
  utils.log('Invite bot to server: https://discord.com/oauth2/authorize?client_id='+bot.application.id+'&scope=bot&permissions=124992')
  utils.log("Guilds:".bgGreen+' '+bot.guilds.size)
  utils.log('Queue db: '+utils.tidyNumber(db.queue.length)+' , Users: '+db.users.length+' , Payments: '+db.payments.length)
  // processQueue()
  bot.getCommands().then(cmds=>{ // check current commands setup, update if needed
    bot.commands = new Collection()
    for (const c of slashCommands) {
      if(cmds.filter(cmd=>cmd.name===c.name).length>0) {
        bot.commands.set(c.name, c) // needed ?
      } else {
        utils.log('Slash command '+c.name+' is unregistered, registering')
        bot.commands.set(c.name, c)
        bot.createCommand({name: c.name,description: c.description,options: c.options ?? [],type: Constants.ApplicationCommandTypes.CHAT_INPUT})
      }
    }
  })
  if (config.hivePaymentAddress.length>0){payment.checkNewPayments()}
})




bot.on("interactionCreate", async (interaction) => {
  if(interaction instanceof Eris.CommandInteraction 
  && authorised(interaction,interaction.channel.id,interaction.guildID)) {//&& interaction.channel.id === config.channelID
    if (!bot.commands.has(interaction.data.name)) 
      return interaction.createMessage({content:'Command does not exist', flags:64}).catch((e) => {utils.log('command does not exist'.bgRed);utils.log(e)})
    try {
      await interaction.acknowledge().then(()=>{
        bot.commands.get(interaction.data.name).execute(interaction)
        interaction.deleteMessage('@original').then(()=>{}).catch((e)=>utils.log(e))
      }).catch((err)=>utils.log(err))
    }
    catch (error) { utils.log(error); await interaction.createMessage({content:'There was an error while executing this command!', flags: 64}).catch((e) => {utils.log(e)}) }
  }
  if((interaction instanceof Eris.ComponentInteraction||interaction instanceof Eris.ModalSubmitInteraction)
    &&authorised(interaction,interaction.channel.id,interaction.guildID)) {
    if(!interaction.member){
      interaction.member={user:{id: interaction.user.id,username:interaction.user.username,bot:interaction.user.bot}}}
      
      var cid=interaction.data.custom_id
      var id=cid.split('-')[1]
      var rn=cid.split('-')[2]
      utils.log(cid.bgCyan.black+' request from '+interaction.member.user.username.bgCyan.black)
      
      pipe_api.process_interaction(interaction)
    }
    if (!authorised(interaction,interaction.channel.id,interaction.guildID)) {
        log('unauthorised usage attempt from'.bgRed)
        log(interaction.member)
        return interaction.createMessage({content:':warning: You dont currently have permission to use this feature', flags:64}).catch((e) => {console.error(e)})
    }
})

bot.on("disconnect", () => {utils.log('disconnected'.bgRed)})
bot.on("error", async (err) => {
 if(err.code===1006) return // ignore discord websocket disconnects
 utils.log(moment().format(), "--- BEGIN: ERROR ---")
 utils.log(err)
 utils.log(moment().format(), "--- END: ERROR ---")
})
bot.on("guildCreate", (guild) => {
  var m='joined new guild: '+guild.name;
  utils.log(m.bgRed);
  directMessageUser(config.adminID,m);
}) // todo send invite to admin
bot.on("guildDelete", (guild) => {var m='left guild: '+guild.name;
  utils.log(m.bgRed);
  directMessageUser(config.adminID,m)
})
bot.on("guildAvailable", (guild) => {var m='guild available: '+guild.name;utils.log(m.bgRed)})
bot.on("channelCreate", (channel) => {var m='channel created: '+channel.name+' in '+channel.guild.name;utils.log(m.bgRed)})
bot.on("channelDelete", (channel) => {var m='channel deleted: '+channel.name+' in '+channel.guild.name;utils.log(m.bgRed)})
bot.on("channelUpdate", (channel,oldChannel) => {
  var m='channel updated: '+channel.name+' in '+channel.guild.name;
  utils.log(m.bgRed);
  if(channel.topic!==oldChannel.topic){
    utils.log('new topic:'+channel.topic)}
})

function extract_user_info_frm_msg(msg){
  user_info = {id:msg.author.id, username:msg.author.username, bot:msg.author.bot,
    channelid: msg.channel.id, guildid: msg.guildID, attachments: msg.attachments}
  return user_info
}

var lastMsgChan=null
bot.on("messageCreate", (msg) => {
  if(msg.author.bot) return // ignore all bot messages

  // an irc like view of non bot messages in allowed channels. Creepy but convenient
  if (config.showChat&&!msg.author.bot){
    if(lastMsgChan!==msg.channel.id&&msg.channel.name&&msg.channel.guild){
      log('#'.bgBlue+msg.channel.name.bgBlue+'-'+msg.channel.id.bgWhite.black+'-'+msg.channel.guild.name.bgBlue+'')
      lastMsgChan=msg.channel.id // Track last channel so messages can be grouped with channel headers
    }
    log(msg.author.username.bgBlue.red.bold+':'+msg.content.bgBlack)
    msg.attachments.map((u)=>{return u.proxy_url}).forEach((a)=>{log(a)})
    msg.embeds.map((e)=>{return e}).forEach((e)=>{log(e)})
    msg.components.map((c)=>{return c}).forEach((c)=>{log(c)})
  }
  // end irc view


  if (msg.author.id !== bot.id && authorised(msg, msg.channel.id, msg.guildID)) {
    var lines = msg.content.split('\n')
    //debugLog('msg.channel.id:'+msg.channel.id+',msg.author.id:'+msg.author.id+',msg.channel.id:'+msg.channel.id+',msg.channel.guild.id:'+msg.channel.guild.id+',msg.guildID:'+msg.guildID)
    cmd_to_match = '!jp3_gen_ad'
    var re = /^(\d+\.\s*)?(!jp3_gen_ad.*)$/
    lines.forEach(line => {
      var match = line.match(re)
      // utils.log("Message matched ", match, line)
      if (match !== null && match[2].split(' ')[0]===cmd_to_match) {
        pipe_type = match[2].substr(11).trim() 
        utils.log("Message recieved ", pipe_type, pipe_type.length)

        user_info = extract_user_info_frm_msg(msg)
        // utils.log("User info ", user_info)
        pipe_api.process_cmdline(user_info, pipe_type)
      }
    })
  }

    var c=msg.content.split(' ')[0]
    if (msg.author.id!==bot.id&&authorised(msg,msg.channel.id,msg.guildID,)){ // Work anywhere its authorized
    switch(c){
      case '!help':{help(msg.channel.id);break}
      case '!recharge':payment.rechargePrompt(msg.author.id,msg.channel.id);break
    }

    if (msg.author.id===config.adminID) { // admins only
    if (c.startsWith('!')){log('admin command: '.bgRed+c)}
    switch(c){
      case '!wipequeue':{break} // disabled // rendering=false;queue=[];dbWrite();log('admin wiped queue')
      case '!queue':{viewQueue();break}
      // case '!cancel':{cancelCurrentRender();try{bot.createMessage(msg.channel.id,':warning: Jobs cancelled')}catch(err){log(err)};break}
      // case '!canceljob':{cancelJob(msg.content.split(' ')[1]);try{bot.createMessage(msg.channel.id,':warning: Job '+msg.content.split(' ')[1]+' cancelled')}catch(err){log(err)};break}
      // case '!canceluser':{cancelUser(msg.content.split(' ')[1]);try{bot.createMessage(msg.channel.id,':warning: Jobs for user '+msg.content.split(' ')[1]+' cancelled')}catch(err){log(err)};break}
      // case '!pause':{try{bot.editStatus('dnd')}catch(err){log(err)};paused=true;rendering=true;try{chat(':pause_button: Bot is paused, requests will still be accepted and queued for when I return')}catch(err){log(err)};break}
      // case '!resume':{socket.emit('requestSystemConfig');paused=false;rendering=false;bot.editStatus('online');chat(':play_pause: Bot is back online');processQueue();break}
      case '!checkpayments':{payment.checkNewPayments();break}
      case '!repostfails':{repostFails();break}
      case '!restart':{log('Admin triggered bot restart'.bgRed.white);exit(0);break}
      case '!creditdisabled':{log('Credits have been disabled'.bgRed.white);creditsDisabled=true;bot.createMessage(msg.channel.id,'Credits have been disabled');break}
      case '!creditenabled':{log('Credits have been enabled'.bgRed.white);creditsDisabled=false;bot.createMessage(msg.channel.id,'Credits have been enabled');break}
      case '!credit':{
        if (msg.mentions.length>0){
          var creditsToAdd=parseFloat(msg.content.split(' ')[1])
          if (Number.isInteger(creditsToAdd)){
            msg.mentions.forEach((m)=>{creditRecharge(creditsToAdd,'manual',m.id)})
            bot.createMessage(msg.channel.id,(msg.mentions.length)+' users received a manual `'+creditsToAdd+'` :coin: topup')
          } else {debugLog('creditsToAdd failed int test');debugLog(creditsToAdd)}
        }
        break
      }
      case '!say':{
        var sayChan=msg.content.split(' ')[1]
        var sayMsg=msg.content.substr((Math.ceil(Math.log10(sayChan+1)))+(msg.content.indexOf(msg.content.split(' ')[1])))
        if(Number.isInteger(parseInt(sayChan))&&sayMsg.length>0){
          log('sending message as arty to '+sayChan+':'+sayMsg)
          try{chatChan(sayChan,sayMsg)}
          catch(err){log('failed to !say with error:'.bgRed);log(err)}
        }
        break
      }
      case '!guilds':{
        debugLog('Guild count: '+bot.guilds.size)
        var guilds = bot.guilds//.sort((a, b) => a.memberCount - b.memberCount)
        guilds.forEach((g)=>{log({id: g.id, name: g.name, ownerID: g.ownerID, description: g.description, memberCount: g.memberCount})})
        break
      }
      case '!leaveguild':{bot.leaveGuild(msg.content.split(' ')[1]);break}
      case '!getmessages':{var cid=msg.content.split(' ')[1];if(cid){bot.getMessages(cid).then(x=>{x.reverse();x.forEach((y)=>{log(y.author.username.bgBlue+': '+y.content);y.attachments.map((u)=>{return u.proxy_url}).forEach((a)=>{log(a)})})})};break}
      case '!updateslashcommands':{bot.getCommands().then(cmds=>{bot.commands = new Collection();for (const c of slashCommands) {bot.commands.set(c.name, c);bot.createCommand({name: c.name,description: c.description,options: c.options ?? [],type: Constants.ApplicationCommandTypes.CHAT_INPUT})}});break}
      case '!deleteslashcommands':{bot.bulkEditCommands([]);break}
      case '!randomisers':{
        var newMsg='**Currently loaded randomisers**\n'
        for (r in randoms){newMsg+='`{'+randoms[r]+'}`='+getRandom(randoms[r])+'\n'}
        if(newMsg.length<=2000){newMsg.length=1999} //max discord msg length of 2k
        //try{chatChan(msg.channel.id,newMsg)}catch(err){log(err)}
        sliceMsg(newMsg).forEach((m)=>{try{bot.createMessage(msg.channel.id, m)}catch(err){debugLog(err)}})
        break
      }
    }
    }
    }
})

main = async()=>{
  // if(config.nsfwChecksEnabled) loadnsfwjs() // only load if needed
  await bot.connect()
  if(config.topggKey&&config.topggKey.length>0){loadtopggposter()}
  // if(!models){socket.emit('requestSystemConfig')}
  // socket.emit("getLoraModels")
  // socket.emit("getTextualInversionTriggers")
  //spinner = await fsPromises.readFile(spinnerFilename,'utf8') // load into memory once only

}
// Actual start of execution flow
main()
