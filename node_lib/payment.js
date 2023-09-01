var cron = require('node-cron')
const hive = require('@hiveio/hive-js')
const debounce = require('debounce')
const axios = require('axios')

module.exports = function (utils, db, bot, config) {
  var module = {};

  var creditsDisabled = false;

  // hive payment checks. On startup, every 15 minutes and on a !recharge call
  if(config.creditsDisabled==='true'){var creditsDisabled=true}else{var creditsDisabled=false}
  if(config.hivePaymentAddress.length>0 && !creditsDisabled){
    var hiveEndpoints = ['https://rpc.ausbit.dev','https://api.hive.blog','https://api.deathwing.me','https://api.c0ff33a.uk',
      'https://hived.emre.sh','https://hive-api.arcange.eu','https://api.hive.blue','https://techcoderx.com',
      'https://hive-api.3speak.tv','https://rpc.mahdiyari.info']
    utils.shuffle(hiveEndpoints)
    hive.config.set('alternative_api_endpoints',hiveEndpoints)
    var hiveUsd = 0.35
    var lastHiveUsd = hiveUsd
    getPrices()
    utils.log("Hive price values ")

    cron.schedule('0,15,30,45 * * * *', () => { log('Checking account history every 15 minutes'.grey); checkNewPayments() })
    cron.schedule('0,30 * * * *', () => { log('Updating hive price every 30 minutes'.grey); getPrices() })
    if(config.freeRechargeAmount&&config.freeRechargeAmount>0){cron.schedule('0 */12 * * *', () => { 
      utils.log('Recharging users with no credit every 12 hrs'.bgCyan.bold);freeRecharge() }) }
  }
  var creditsRemaining = function (userID){return db.users.find(x=>x.id===userID).credits}
  var createNewUser = function(id){
    if(id.id){id=id.id}
    db.users.push({id:id, credits:1}) // 100 creds for new users
    dbWrite() // Sync after new user
    utils.log('created new user with id '.bgBlue.black.bold + id)
  }
  module.userCreditCheck = userCreditCheck = function(userID,amount) { // Check if a user can afford a specific amount of credits, create if not existing yet
    var user=db.users.find(x=>x.id===String(userID))
    // utils.log("db access val ", String(userID), db.users)
    if(!user){createNewUser(userID);user=db.users.find(x=>x.id===String(userID))}
    if(parseFloat(user.credits)>=parseFloat(amount)||creditsDisabled){return true}
    else{rechargePrompt(userid,channel); return false}
  } 
  async function directMessageUser(id,msg,channel){ // try, fallback to channel
    d = await bot.getDMChannel(id).catch(() => {
      utils.log('failed to get dm channel, sending public message instead')
      if (channel&&channel.length>0){bot.createMessage(channel,msg).then(()=>{
        utils.log('DM sent to '.dim+id)}).catch((err) => {
          utils.log(err);utils.log('failed to both dm a user or message in channel'.bgRed.white)})}
    })
    d.createMessage(msg).catch(() => {
      if (channel&&channel.length>0){bot.createMessage(channel,msg).then(()=>{
        utils.log('DM sent to '.dim+id)}).catch((err) => {
          utils.log(err);utils.log('failed to both dm a user or message in channel'.bgRed.white)})}
    })
  } 
  module.rechargePrompt = function(userid,channel){
    userCreditCheck(userid,1) // make sure the account exists first
    checkNewPayments()
    var hive1usd = (1/hiveUsd).toFixed(3)
    var paymentMemo=config.hivePaymentPrefix+userid
    var paymentLinkHbd='https://hivesigner.com/sign/transfer?to='+config.hivePaymentAddress+'&amount=1.000%20HBD&memo='+paymentMemo
    var paymentLinkHive='https://hivesigner.com/sign/transfer?to='+config.hivePaymentAddress+'&amount='+hive1usd+'%20HIVE&memo='+paymentMemo
    var lightningInvoiceQr=getLightningInvoiceQr(paymentMemo)
    var paymentMsg=''
    paymentMsg+='<@'+userid+'> you have `'+creditsRemaining(userid)+'` :coin: remaining\n*The rate is `1` **USD** per `500` :coin: *\n'
    paymentMsg+= 'You can send any amount of HIVE <:hive:1110123056501887007> or HBD <:hbd:1110282940686016643> to `'+
      config.hivePaymentAddress+'` with the memo `'+paymentMemo+'` to top up your balance\n'
    //paymentMsg+= '**Pay 1 HBD:** '+paymentLinkHbd+'\n**Pay 1 HIVE:** '+paymentLinkHive
    var freeRechargeMsg='..Or just wait for your FREE recharge of 10 credits twice daily'
    var rechargeImages=[
      'https://media.discordapp.net/attachments/1024766656347652186/1110852592864595988/237568213750251520-1684918295766-text.png',
      'https://media.discordapp.net/attachments/1024766656347652186/1110862401420677231/237568213750251520-1684920634773-text.png',
      'https://media.discordapp.net/attachments/1024766656347652186/1110865969645105213/237568213750251520-1684921485321-text.png',
      'https://media.discordapp.net/attachments/968822563662860338/1110869028475523174/237568213750251520-1684922214077-text.png',
      'https://media.discordapp.net/attachments/1024766656347652186/1110872463736324106/237568213750251520-1684923032433-text.png',
      'https://media.discordapp.net/attachments/1024766656347652186/1110875096106676256/237568213750251520-1684923660927-text.png',
      'https://media.discordapp.net/attachments/1024766656347652186/1110876051694952498/237568213750251520-1684923889116-text.png',
      'https://media.discordapp.net/attachments/1024766656347652186/1110877696726159370/237568213750251520-1684924281507-text.png',
      'https://media.discordapp.net/attachments/968822563662860338/1110904225384382554/merged_canvas.da2c2db8.png']
    utils.shuffle(rechargeImages)
    var paymentMsgObject={
      content: paymentMsg,
      embeds:
      [
        {image:{url:rechargeImages[0]}},
        {footer:{text:freeRechargeMsg}}
      ],
      components: [
        {type: 1, components:[
          {type: 2, style: 5, label: hive1usd+" HIVE", url:paymentLinkHive, emoji: { name: 'hive', id: '1110123056501887007'}, disabled: false },
          {type: 2, style: 5, label: "1 HBD", url:paymentLinkHbd, emoji: { name: 'hbd', id: '1110282940686016643'}, disabled: false },
          {type: 2, style: 5, label: "$1 of BTC", url:lightningInvoiceQr, emoji: { name: '⚡', id: null}, disabled: false }
        ]}
      ]
    }
    directMessageUser(userid,paymentMsgObject,channel).catch((err)=>utils.log(err))
    utils.log('ID '+userid+' asked for recharge link')
  }

  module.balancePrompt = function(userid,channel){
    userCreditCheck(userid,1) // make sure the account exists first
    var msg='<@'+userid+'> you have `'+creditsRemaining(userid)+'` :coin:'
    bot.createMessage(channel,msg).then().catch(err=>{utils.log(err)})
  }
  module.chargeCredits = function (userID,amount){
    if(!creditsDisabled){
      var user=db.users.find(x=>x.id===userID)
      utils.log("Credits charged ", db.users, userID)
      if (user){
        user.credits=(user.credits-amount).toFixed(2)
        dbWrite()
        var z='charged id '+userID+' - '+amount.toFixed(2)+'/'
        if(user.credits>90){z+=user.credits.bgBrightGreen.black}
        else if(user.credits>50){z+=user.credits.bgGreen.black}
        else if(user.credits>10){z+=user.credits.bgBlack.white}
        else{z+=user.credits.bgRed.white}
        utils.log(z.dim.bold)
      } else {
        utils.log('Unable to find user: '+userID)
      }
    }
  }
  module.creditTransfer = async function(credits,from,to,channel){ // allow credit transfers between users
    var userFrom=users.find(x=>x.id===from)
    var userTo=users.find(x=>x.id===to)
    if(!userTo){createNewUser(to);userTo=users.find(x=>x.id===to)}
    if(parseFloat(credits)&&userFrom&&userTo&&parseFloat(userFrom.credits)>(parseFloat(credits)+100)){ // Only allow users to transfer credits above and beyond the starter balance (only paid credit)
      userFrom.credits=parseFloat(userFrom.credits)-parseFloat(credits) // todo charge user function rather then directly subtract from db
      creditRecharge(credits,'transfer',userTo.id,credits+' CREDITS',userFrom.id) // add user credit, log in payment db
      //userTo.credits=parseFloat(userTo.credits)+parseFloat(credits)
      //payments.push({credits:credits,txid:'transfer',timestamp:moment.now(),userid:userTo,userFrom:userFrom,amount:credits+' CREDITS'})
      //dbWrite() // save db after transfers
      var successMsg='<@'+from+'> gifted `'+credits+'` :coin: to <@'+to+'>'
      utils.log(successMsg)
      try{bot.createMessage(channel,successMsg)}catch(err){utils.log(err)}
    } else if (parseFloat(credits)>parseFloat(userFrom.credits)) {
      var errorMsg=':warning: <@'+from+'> has insufficient balance to gift `'+credits+'` :coin:'
      try{bot.createMessage(channel,errorMsg)}catch(err){utils.log(err)}
    } else if (parseFloat(userFrom.credits)>(parseFloat(credits)+100)) {
      var errorMsg=':warning: Only paid credit beyond the initial 100 free :coin: can be transferred'
      try{bot.createMessage(channel,errorMsg)}catch(err){utils.log(err)}
    } else {
      utils.log('Gifting failed for '+from)
    }
  }

  async function creditRecharge(credits,txid,userid,amount,from){ // add credit to user
    var user=users.find(x=>x.id===userid)
    if(!user){await createNewUser(userid);var user=users.find(x=>x.id===userid)}
    if(user&&user.credits){user.credits=(parseFloat(user.credits)+parseFloat(credits)).toFixed(2)}
    if(!['manual','free','transfer'].includes(txid)){
      payments.push({credits:credits,timestamp:moment.now(),txid:txid,userid:userid,amount:amount,})
      var paymentMessage = ':tada: <@'+userid+'> added :coin:`'+credits+'`, balance is now :coin:`'+user.credits+
        '`\n:heart_on_fire: Thanks `'+from+'` for the `'+amount+'` donation to the GPU fund.\n Type !recharge to get your own topup info'
      chat(paymentMessage)
      directMessageUser(config.adminID,paymentMessage)
    }
    dbWrite()
  }
  function freeRecharge(){
    // allow for regular topups of empty accounts
    // new users get 100 credits on first appearance, then freeRechargeAmount more every 12 hours IF their balance is less then freeRechargeMinBalance
    var freeRechargeMinBalance=parseInt(config.freeRechargeMinBalance)||10
    var freeRechargeAmount=parseInt(config.freeRechargeAmount)||10
    var freeRechargeUsers=users.filter(u=>u.credits<freeRechargeMinBalance)
    if(freeRechargeUsers.length>0&&freeRechargeAmount>0){
      utils.log(freeRechargeUsers.length+' users with balances below '+freeRechargeMinBalance+' getting a free '+freeRechargeAmount+' credit topup')
      freeRechargeUsers.forEach(u=>{
        var nc = parseFloat(u.credits)+freeRechargeAmount  // Incentivizes drain down to 9 for max free charge leaving balance at 19
        creditRecharge(nc,'free',u.id,nc+' CREDITS',config.adminID)
        directMessageUser(u.id,':fireworks: You received a free '+freeRechargeAmount+' :coin: topup!\n:information_source:Everyone with a balance below '+
          freeRechargeMinBalance+' will get this once every 12 hours')
      })
      chat(':fireworks:'+freeRechargeUsers.length+' users with a balance below `'+freeRechargeMinBalance+'`:coin: just received their free credit recharge')
    }else{
      utils.log('No users eligible for free credit recharge')
    }
  }
  function getPrices () {
    utils.time('getPrices')
    var url='https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=hive&order=market_cap_asc&per_page=1&page=1&sparkline=false'
    axios.get(url)
      .then((response)=>{hiveUsd=response.data[0].current_price;lastHiveUsd=hiveUsd;utils.log('HIVE: $'+hiveUsd)})
      .catch(()=>{
        utils.log('Failed to load data from coingecko api, trying internal market'.red.bold)
        axios.post(hiveEndpoints[0], {id: 1,jsonrpc: '2.0',method: 'condenser_api.get_ticker',params: []})
          .then((hresponse)=>{hiveUsd=parseFloat(hresponse.data.result.latest);utils.log('HIVE (internal market): $'+hiveUsd)})
          .catch((err)=>{utils.log('Failed to load data from hive market api');utils.log(err);hiveUsd=lastHiveUsd})
      })
      utils.timeEnd('getPrices')
  }
  function getLightningInvoiceQr(memo,amount=1){
    var appname=config.hivePaymentAddress+'_discord'
    return 'https://api.v4v.app/v1/new_invoice_hive?hive_accname='+config.hivePaymentAddress+'&amount='+amount+
      '&currency=HBD&usd_hbd=false&app_name='+appname+'&expiry=300&message='+memo+'&qr_code=png'
  }

  var checkNewPayments = async function(){
    utils.time('checkNewPayments')
    // Hive native payments support
    var bitmask=['4','524288'] // transfers and fill_recurrent_transfer only
    var accHistoryLength=config.accHistoryLength||100 // default 100
    utils.log('Checking recent payments for '.grey+config.hivePaymentAddress.grey)
    hive.api.getAccountHistory(config.hivePaymentAddress, -1, accHistoryLength, ...bitmask, function(err, result) {
      if(err){utils.log(err)}
      if(Array.isArray(result)) {
        result.forEach(r=>{
          var tx=r[1]
          var txType=tx.op[0]
          var op=tx.op[1]
          if(txType==='transfer'&&op.to===config.hivePaymentAddress&&op.memo.startsWith(config.hivePaymentPrefix)){
            var amountCredit=0
            var accountId=op.memo.replace(config.hivePaymentPrefix,'')
            var pastPayment=payments.find(x=>x.txid===tx.trx_id)
            if(pastPayment===undefined){
              coin=op.amount.split(' ')[1]
              amount=parseFloat(op.amount.split(' ')[0])
              if(coin==='HBD'){amountCredit=amount*500}else if(coin==='HIVE'){amountCredit=(amount*hiveUsd)*500}
              utils.log('New Payment! credits:'.bgBrightGreen.red+amountCredit+' , amount:'+op.amount)
              creditRecharge(amountCredit,tx.trx_id,accountId,op.amount,op.from)
            }
          }
        })
      } else {utils.log('error fetching account history'.bgRed)}
    })
    // Hive-Engine payments support
    if(config.allowHiveEnginePayments){
      var allowedHETokens=['SWAP.HBD','SWAP.HIVE']
      try{response = await axios.get('https://history.hive-engine.com/accountHistory?account='+config.hivePaymentAddress+'&limit='+
        accHistoryLength+'&offset=0&ops=tokens_transfer')}catch(err){utils.log(err)}
      var HEtransactions=response?.data
      var HEbotPayments=HEtransactions.filter(t=>t.to===config.hivePaymentAddress&&allowedHETokens.includes(t.symbol)&&t.memo?.startsWith(config.hivePaymentPrefix))
      HEbotPayments.forEach(t=>{
        var pastPayment=payments.find(tx=>tx.txid===t.transactionId)
        var usdValue=0
        var userid=parseInt(t.memo.split('-')[1])
        if(pastPayment===undefined&&isInteger(userid)){ // not in db yet, memo looks correct
          switch(t.symbol){ // todo get market price for other tokens, keeping it simple for now
            case 'SWAP.HIVE': usdValue=parseFloat(t.quantity)*(hiveUsd*0.9925);break // treat like regular HIVE - 0.75% HE withdraw fee
            case 'SWAP.HBD': usdValue=parseFloat(t.quantity)*0.9925;break // treat like regular HBD and peg to $1 - 0.75% HE withdraw fee
            default: usdValue=0;break // shouldn't happen, just in case
          }
          var credits=usdValue*500
          utils.log('New Payment! credits:'.bgBrightGreen.red+credits+' , amount:'+t.quantity+' '+t.symbol+' , from: '+t.from)
          creditRecharge(credits,t.transactionId,userid,t.quantity+' '+t.symbol,t.from)
        }
      })
    }
    utils.timeEnd('checkNewPayments')
  }
  module.checkNewPayments=debounce(checkNewPayments,30000,true) // at least 30 seconds between checks
  return module;
};

// List of features to be verified:
// - The cost for job would be pulled from GPU. Probably it is updated in gpu state 
//   - Also allow user to generate images till his cost goes negative coins 
// - Check the payments every N secods to update the recharge payments (checkNewPayments)
// - When user gives recharge command pop up recharge or when user has insufficient funds (rechargePrompt)
// - Add support for balance enquiry 

// if(config.showFilename==='true'){var showFilename=true}else{var showFilename=false}
// if(config.showPreviews==='true'){var showPreviews=true}else{var showPreviews=false}
// if(config.showRenderSettings==='true'){var showRenderSettings=true}else{var showRenderSettings=false}
// if(config.statsAdminOnly==='true'){var statsAdminOnly=true}else{var statsAdminOnly=false}

// function costCalculator(job) {                 // Pass in a render, get a cost in credits
//   if(creditsDisabled){return 0}                // Bypass if credits system is disabled
//   var cost=1                                   // a normal render base cost, 512x512 30 steps
//   var pixelBase=defaultSize*defaultSize        // reference pixel size
//   var pixels=job.width*job.height              // How many pixels does this render use?
//   cost=(pixels/pixelBase)*cost                 // premium or discount for resolution relative to default
//   cost=(job.steps/defaultSteps)*cost           // premium or discount for step count relative to default
//   if (job.gfpgan_strength!==0){cost=cost*1.05} // 5% charge for gfpgan face fixing (minor increased processing time)
//   if (job.codeformer_strength!==0){cost=cost*1.05} // 5% charge for gfpgan face fixing (minor increased processing time)
//   if (job.upscale_level===2){cost=cost*1.5}    // 1.5x charge for upscale 2x (increased processing+storage+bandwidth)
//   if (job.upscale_level===4){cost=cost*2}      // 2x charge for upscale 4x
//   if (job.hires_fix===true){cost=cost*1.5}     // 1.5x charge for hires_fix (renders once at half resolution, then again at full)
//   //if (job.channel!==config.channelID){cost=cost*1.1}// 10% charge for renders outside of home channel
//   cost=cost*job.number                         // Multiply by image count
//   return cost.toFixed(2)                       // Return cost to 2 decimal places
// }
