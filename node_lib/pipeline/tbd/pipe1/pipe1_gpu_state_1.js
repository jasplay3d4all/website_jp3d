var pipeline_state = {
    name: "pipe1",
    config:{ // State 0: Base config state
        theme: "food",
        num_scene: 4, // number of scenes to be used for this ad
        // Fixed by the pipeline type
        num_stages: 3, // number of stages based on this template. Image Generation, Video Generation, Video Stitching
    },
    cur_stage_idx: 0,
    stage_state:[{
            config:{ // State 1: Image generation state
                fg_prompt: [], // fg for N scenes
                bg_prompt: [],
            },
            gpu_state:{
                cur_img_idx: 0, // Current image generation index
                stage_status:"in_queue", // "pre_stage" "in_queue", "gpu_triggered", "error", "complete"
                stage_progress: 0, // Percentage of task completion
            }
        },{
            config:{ // State 2: Video motion generation state
                motion_template: [] // motion template for N scenes - Zoom, Pan right, Pan left
            },
            gpu_state:{
                cur_vdo_idx: 0, // Current video generation index
            }
        },{
            config:{ // State 3: Video stitching state
                video_ordering: "" // "default", "1,2,3,L", "2,1,3,L" L - logo
            },
            gpu_state:{
                stage_status:"pre_stage", // "pre_stage" "in_queue", "gpu_triggered", "error", "complete"
                stage_progress: 0, // Percentage of task completion
            }
        }
    ],
    user_state:{
        info:{
            id:"",
        },
        gpu_state:{
        }
    }
}
module.exports = pipeline_state
