module.exports = function () {
    var module = {};

    module.pipeline_state = {
        name: "single_state",
        cur_stage_idx: 0,
        pipe_info:{label:"Social Media Post", id:"social_media_post"}, //Not sure whether it is required
        user_state:{
            info:{
                id:"JAYKANIDAN",
                attachments: [{url:"./share_vol/data_io/inp/logo_mealo.png", 
                    filename: '00000.png', width: 512, height: 512, content_type: 'image/png'}]
            },
            gpu_state:{} //Not sure whether it is required. Probably future use
        },
        stage_state:[{
            // Stage 0: Generate the logo image
            //gen_img(theme, prompt, op_fld, control_type=None, ctrl_img=None, n_prompt="", height=512, width=512, 
            // seed=-1, num_images=1, safety_checker=None, collect_cache=True)
              config:{ 
                   theme:{val : "food", label: "Theme", show: true, type:"default"},
                   prompt:{val : "The scene transitions to a beautifully set dining table, showcasing an assortment of chapathi\
                    and dosas on a traditional Indian thali. The chapathis are stacked neatly, and the dosas are folded into\
                    triangles, ready to be enjoyed. Bowls of aromatic curries, chutneys, and pickles accompany the dishes,\
                    adding a burst of colors to the presentation.",label: "Prompt", show: true, type:"default"},
                   op_fld:{val : "./img/", show: false, type:"path"},
            },
            gpu_state:{ 
              function: "gen_logo", // Name of the function to call
              stage_status:"in_queue", // "pre_stage" "in_queue", "gpu_triggered", "error", "complete"
              stage_progress: 0, // Percentage of task completion
              output:['https://tmpfiles.org/1900371/generated123.mp4',
                      'https://tmpfiles.org/1900371/generated123.mp4'],
            }},{
            // Stage 1: Generate a video using the above image
            // gen_vdo_ado_speech(theme, prompt, img_path, motion_template, op_fld, bg_music_prompt=None, voice_text=None, **gen_vdo_args)
            config:{ 
                img_path:{val : {stg_idx:0, type:"array2idx", idx:0}, show: false, type:"wrkflw_link"},
                theme:{val : "food", label: "Theme", show: false, type:"default"},
                prompt:{val : "The background is indian restaurant's warm and welcoming ambiance sets the stage for a delightful dining experience",
                        label: "Prompt", show: false, type:"default"},
                motion_template:{val:"pan_bottom_left", label: "Motion Template", show: true, type:"default"},
                bg_music_prompt:{val:"Tabla and sitar music intertwine, peaceful Indian folk song", 
                    label: "BG Music", show: true, type:"default"},
                voice_text:{val:"Meealo, One stop destination for all cravings", 
                    label: "Voice Text", show: true, type:"default"},
                op_fld:{val : "./vdo/", show: false, type:"path"}
            },
            gpu_state:{ 
                function: "gen_vdo_ado_speech", // Name of the function to call
                stage_status:"in_queue", // "pre_stage" "in_queue", "gpu_triggered", "error", "complete"
                stage_progress: 0, // Percentage of task completion
                output:['https://tmpfiles.org/1900371/generated123.mp4'],
            }},
        ],
    }
    return module;
};