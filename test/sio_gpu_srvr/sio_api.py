

import eventlet
import socketio
from types import SimpleNamespace
import json
sio = socketio.Server(cors_allowed_origins=['*'])

from pipe1 import pipe1

pipe_list = {
    'pipe1':pipe1(),
}
data_io_path = "./share_vol/data_io/"
static_files={
    # '/': {'content_type': 'text/html', 'filename': './data_io/index.html'},
    '/static': data_io_path,
}


class SocketIOApi(socketio.Namespace):
    # def __init__(self):
    #     self.active_pipe = None
    #     return
    def on_connect(self, sid, environ):
        print('connect ', sid, environ)
        return

    def on_disconnect(self, sid):
        print('disconnect ', sid)
        return
    def on_connect_error(data):
        print("The connection failed!", data)

    def on_gpu_job_start(self, sid, pipe_state):
        # Convert JSON object to python object
        # pipe_state = json.loads(pipe_state, object_hook=lambda d: SimpleNamespace(**d))
        print('gpu_job_start ', sid)

        # # Check whether the current pipe is active but it is not the current job to be executed
        # if(self.active_pipe != None or pipe_state.name != self.active_pipe.name):
        #     if(self.active_pipe and self.active_pipe.name):
        #         self.active_pipe.unload()
        #     self.active_pipe = pipe_list[pipe_state.name].load(pipe_state, self)

        # self.active_pipe.process(pipe_state)

        self.emit('gpu_job_complete', pipe_state)
        print('gpu_job_complete emitted', sid)
        return

    def progress_cb(self, pipe_state):
        self.emit('gpu_job_progress', pipe_state)
        return

    def error_cb(self, pipe_state):
        self.emit('gpu_job_error', pipe_state)
        return

sio.register_namespace(SocketIOApi('/gpu'))

app = socketio.WSGIApp(sio, static_files=static_files)

# # on - generateImage getLoraModels getTextualInversionTriggers requestSystemConfig requestModelChange cancel 
# # emit - generationResult postprocessingResult systemConfig modelChanged progressUpdate intermediateResult
# # foundLoras foundTextualInversionTriggers error 
# @sio.on('generate_image')
# def generate_image(sid, runtime_cfg):
#     print('message ', data)

#     sio.emit('generated_image', {'status': 'image generated'})



if __name__ == '__main__': 
    eventlet.wsgi.server(eventlet.listen(('127.0.0.1', 8000)), app)
    # eventlet.wsgi.server(eventlet.listen(('', 80)), app)
