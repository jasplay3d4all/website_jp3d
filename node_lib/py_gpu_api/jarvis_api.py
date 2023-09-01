from jlclient import jarvisclient
from jlclient.jarvisclient import *
import os


jarvisclient.token = os.environ['JARVIS_TOK']
jarvisclient.user_id = os.environ['JARVIS_USR_ID'] 

def get_instance_by_name(name = os.environ['JARVIS_GPU_NAME']):
    if(!name):
        print("Instance name not initialized in environment ", name)
        return None
    instances_list = User.get_instances(status=None)
    machine_id = None
    for instance in instances_list:
        if(instance.name == name):
            return instance
    # if(machine_id):
    #     return User.get_instance(machine_id)
    # else:
    print("The specified name instance does not exist ", name)
    return None
