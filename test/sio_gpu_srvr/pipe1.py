import os
import sys

# Model
# from lib.hf.sd_bot_api import sd_model as sd_mdl_bot_api

# class pipe1:
#     name="pipe1"
#     def __init__(self, job_config):
#         return
    
#     def unload(self):
#         return
    
#     def process(self, job_config, progress_cb, error_cb):
#         return

class pipe1:
    name="pipe1"
    def __init__(self):
        self.model_name = "model1"
        self.fn_map = {
            "gen_img":self.gen_img,
            "gen_vdo":self.gen_vdo,
            "order_vdo":self.order_vdo
                }
        return
    
    
    def unload(self, stage_state_0):
        return
    def load(self, stage_state_0, sio_api):
        # Use the stage_state 0 to configure the pipe
        self.sio_api = sio_api; # Store the sio api class to call progress and error call back
        return

    def process(self, pipe_state):
        stage_state = pipe_state.stage_state[pipe_state.cur_stage_idx];
        self.fn_map[stage_state.gpu_state.function](stage_state);
        return

    def gen_img(self, stage_state):
        print("Image Generation State ", stage_state.gpu_state)
        return
    
    def gen_vdo(self, stage_state):
        print("Video Generation State ", stage_state.gpu_state)
        return 
    
    def order_vdo(self, stage_state):
        print("Order video ", stage_state.gpu_state)
        return 
