Backing Up Code:
----------------
zip -r website_jp3d_v0.0.1.zip ./website_jp3d -x website_jp3d/.github/**\*  '*__pycache__*/*' '*.DS_Store*'
zip -r website_jp3d_v0.0.2.zip ./website_jp3d -x website_jp3d/.github/**\* website_jp3d/node_modules/**\*  '*__pycache__*/*' '*.DS_Store*'
zip -r website_jp3d_v0.0.7.zip ./website_jp3d -x  website_jp3d/node_modules/**\*  '*__pycache__*/*' '*.DS_Store*' website_jp3d/storage/data_io/**\* website_jp3d/.git/**\* website_jp3d/test/sio_gpu_srvr/share_vol/data_io/**\*

Discord -> Bot -> GPU


Deployment:
----------
GPU backend mock:
=================
apt-get update
apt install zip python3-pip python-is-python3 -y
apt-get install iputils-ping net-tools -y
pip install eventlet python-socketio
<!-- pip install distest  -->

Discord Bot Install:
===================
<!-- https://github.com/nodesource/distributions#debinstall -->
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs
<!-- https://github.com/nodesource/distributions#ubuntu-versions -->
cd ./website_jp3d/
npm install
npm install --legacy-peer-deps
npm install supervisor concurrently -g

In a new terminal(Running Bot):
------------------------------
cd ./website_jp3d/
supervisor node_lib/main.js
alt: node node_lib/main.js 

In a new terminal(Running GPU):
----------------------
cd  ./website_jp3d/test/sio_gpu_srvr/
python3 sio_api.py

concurrently "supervisor node_lib/main.js" "cd ./test/sio_gpu_srvr/; python sio_api.py"

pip install gunicorn
uvicorn socketio_server:app --port 6006 --reload
gunicorn sio_server:app -b '127.0.0.1:8000' --reload

List of features:
- Ability to preview vdo output
- Ability to reset and delete all user info etc
- Validation of configuration using json
- Ability to connect output from one stage to another stage configuration
    - make val as default (use cfg value), prev_stg_op (specify stg id and cfg param), or get it from user
- Add support for uploading images and display images. Take input logo image and product image
    - parse during commandline input and store on remote GPU as input and store path in pipe state
- How to take care of stage where there is no user input but just past inputs are sufficient?
- How to introduce async functionality
- Handling of errors
- Handling of progress
- bot.on("ready" - Trigger the processing of the queue if it has to be processed
- Use HiveAccount and enable payments
- Generate gifs for preview? IS Gif size smaller than video
- Add support for more stages like after full preview like gifs and images and then do generate video
- Add support for handling NSFW, support for adding output to gallery if user reacts to an output feedbCK
    - messageReactionAdd
- Add support for progress bar - emoji progress bar
- repost fail i.e show generated result and if it fails track and maintain
- Help prompt feature
- Disable submit and other buttons  for previous UI elements
- [x] DB updates not written to file

Bot Document:
https://abal.moe/Eris/docs/0.16.1/ComponentInteraction

bot.on("ready", async () => {

bot.on("interactionCreate", async (interaction) => {

bot.on("messageCreate", (msg) => {
    cmd_to_match = '!jp3_gen_ad'
pipe_api.process_cmdline(user_info, pipe_type)

