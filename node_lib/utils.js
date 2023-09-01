module.exports = function (config) {
  var module = {};
  function jarThemPickles(pickle, jar) {
      // This will be NOT available 'outside'.
      // Pickling stuff...

      return pickleJar;
  };


  module.log = console.log.bind(console)
  module.debugLog = function(m){if(config.showDebug){log(m)}}
  module.time = function (label){if(config.showDebugPerformance){console.time(label)}}
  module.timeEnd = function(label){if(config.showDebugPerformance){console.timeEnd(label)}}
  module.loop = (times, callback) => {[...Array(times)].forEach((item, i) => callback(i))}
  
  module.shuffle = function(array) {for (let i = array.length - 1; i > 0; i--) {let j = Math.floor(Math.random() * (i + 1));[array[i], array[j]] = [array[j], array[i]]}} // fisher-yates shuffle
  module.unique = (value, index, self) => { return self.indexOf(value) === index }
  module.getRandomColorDec=()=>{return Math.floor(Math.random()*16777215)}
  module.clearParent=function(interaction) {
    var label=':saluting_face: **'+interaction.data.custom_id.split('-')[0].replace('twk','')+'** selected'
    try{
      if(interaction?.message?.flags){// ephemeral message that cannot be deleted by us, only edited
        utils.log("Edit parent called");
        try{return interaction.editParent({content: label,components: [],embeds:[]}).then(()=>{}).catch(e=>{if(e){}})}catch(err){log(err)}
      } else if (interaction.message) { // regular message reference
        utils.log("Create message called");
        try{interaction.createMessage({content:label,flags:64}).then(()=>{}).catch(e=>{if(e){}})}catch(err){log(err)}
      }
    }catch(err){log(err)}
  }
  const timeDiff=(date1,date2)=>{return date2.diff(date1, 'seconds')}
  const getRandom=(what)=>{
    if(randoms.includes(what)){
      try{
        var lines=randomsCache[randoms.indexOf(what)]
        return lines[Math.floor(Math.random()*lines.length)]
      }catch(err){log(err)}
    }else{return what}
  }
  const replaceRandoms=(input)=>{
    var output=input
    randoms.forEach(x=>{
      var wordToReplace='{'+x+'}'
      var before='';var after='';var replacement=''
      var wordToReplaceLength=wordToReplace.length
      var howManyReplacements=output.split(wordToReplace).length-1 // todo can we improve this?
      for (let i=0;i<howManyReplacements;i++){ // to support multiple {x} of the same type in the same prompt
        var wordToReplacePosition=output.indexOf(wordToReplace) // where the first {x} starts (does this need +1?)
        if (wordToReplacePosition!==-1&&wordToReplacePosition > 0 && wordToReplacePosition < output.length - wordToReplaceLength){ // only continue if a match was found
          var wordToReplacePositionEnd=wordToReplacePosition+wordToReplaceLength
          before=output.substr(0,wordToReplacePosition)
          replacement=getRandom(x)
          after=output.substr(wordToReplacePositionEnd)
          output=before+replacement+after
        } else if (wordToReplacePosition === 0) {
          replacement = getRandom(x)
          output = replacement + output.substr(wordToReplaceLength)
        } else if (wordToReplacePositionEnd === output.length) {
          output = output.substr(0, wordToReplacePositionEnd - wordToReplaceLength) + getRandom(x)
        }
      }
    })
    return output
  }
  
  const partialMatches=(strings,search)=>{
    let results = []
    for(let i=0;i<strings.length;i++){if(searchString(strings[i], search)){results.push(strings[i])}}
    return results 
  } 
  
  const searchString=(str,searchTerm)=>{
    let searchTermLowerCase = searchTerm.toLowerCase() 
    let strLowerCase = str.toLowerCase() 
    return strLowerCase.includes(searchTermLowerCase) 
  }
  const metaDataMsg=async(imageurl,channel)=>{
  //async function metaDataMsg(imageurl,channel){
    debugLog('attempting metadata extraction from '+imageurl)
    try{var metadata = await ExifReader.load(imageurl)
    }catch(err){log(err)}
    var newMsg='Metadata for '+imageurl+' \n'
    Object.keys(metadata).forEach((t)=>{
      newMsg+='**'+t+'**:'
      Object.keys(metadata[t]).forEach((k)=>{
        if(k==='description'&&metadata[t][k]===metadata[t]['value']){
        } else {
          if(k==='value'){newMsg+='`'+metadata[t][k]+'`'}
          if(k==='description'){newMsg+=' *'+metadata[t][k]+'*'}
        }
      })
      newMsg+='\n'
    })
    if(newMsg.length>0&&newMsg.length<10000){sliceMsg(newMsg).forEach((m)=>{try{bot.createMessage(channel, m)}catch(err){debugLog(err)}})} else {debugLog('Aborting metadata message, response too long')}
  }
  
  module.tidyNumber=(x)=>{if(x){var parts=x.toString().split('.');parts[0]=parts[0].replaceAll(/\B(?=(\d{3})+(?!\d))/g, ',');return parts.join('.')}else{return null}}
  const sliceMsg=(str)=>{
    const chunkSize=1999
    let chunks=[];let i=0;let len=str.length
    while(i<len){chunks.push(str.slice(i,i+=chunkSize))}
    return chunks
  }
  const sliceMsg2=(str)=>{
    const chunkSize=1999
    let chunks=[];let i=0;let len=str.length
    while(i<len){
      let chunk=str.slice(i,i+chunkSize)
      let lastNewlineIndex=chunk.lastIndexOf('\n')
      if(lastNewlineIndex!==-1&&chunkSize-lastNewlineIndex<=40){
        chunks.push(chunk.slice(0,lastNewlineIndex))
        i+=lastNewlineIndex+1
      }else{
        chunks.push(chunk)
        i+=chunkSize
      }
    }
    return chunks
  }
  const clearParent=async(interaction)=>{
    var label=':saluting_face: **'+interaction.data.custom_id.split('-')[0].replace('twk','')+'** selected'
    try{
      if(interaction?.message?.flags){// ephemeral message that cannot be deleted by us, only edited
        try{return await interaction.editParent({content: label,components: [],embeds:[]}).then(()=>{}).catch(e=>{if(e){}})}catch(err){log(err)}
      } else if (interaction.message) { // regular message reference
        try{await interaction.createMessage({content:label,flags:64}).then(()=>{}).catch(e=>{if(e){}})}catch(err){log(err)}
      }
    }catch(err){log(err)}
  }

  
  function convert_string_to_keyvalue(cmd){
    cmd_options = cmd.trim().split('-')
    options_kv = {}
    for(var i = 0; i < cmd_options.length; i++){
      opt_split = cmd_options[i].split(' ')
      if(opt_split[0].trim()){
        options_kv[opt_split[0].trim()] = cmd_options[i].substr(opt_split[0].length).trim()
        // utils.log("Arg key value ", options_kv[opt_split[0]], opt_split[0])
      }
    }
    utils.log("options_kv ", options_kv)
    return options_kv
  }


  function chat(msg){if(msg!==null&&msg!==''){try{bot.createMessage(config.channelID, msg)}catch(err){log(err)}}}
  function chatChan(channel,msg){if(msg!==null&&msg!==''){try{bot.createMessage(channel, msg)}catch(err){log('Failed to send with error:'.bgRed);log(err)}}}
  
  



  return module;
};
