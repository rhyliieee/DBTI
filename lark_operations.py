from baseopensdk import BaseClient
from baseopensdk.api.base.v1 import *
import json

import lark_oapi as lark
from lark_oapi.api.bitable.v1 import *

# INTERNAL IMPORT
from data_models import LarkPostRequest

# CLASS TO HANDLE LARK OPERATIONS
# class LarkClient:
#     def __init__(self, app_token: str, personal_base_token: str):
#         self.app_token = app_token or "DXP2bDfzXaC6hOsx2XFliaJlgPh"
#         self.personal_base_token = personal_base_token or "pt-Fh3UE7oqxPtLmGddjvaSZKiIqmBfPT5gZZ1l6meVAQAAH0DAYB9AQEBKEXb_"
    
#     # FUNCTION TO INITIALIZE LARK CLIENT
#     def init_lark_client(self):
#         self.client = BaseClient.builder().app_token(self.app_token) \
#         .personal_base_token(self.personal_base_token).build()

#     # FUNCTION TO LIST ALL TABLES IN LARK BASE
#     def list_tables(self) -> List[str]:
#         # INITIALIZE LARK CLIENT
#         self.init_lark_client()

#         # LIST ALL TABLES
#         tables = self.client.base.v1.app_table.list(ListAppTableRequest().builder())

#         # RETURN TABLE NAMES
#         return [table.name for table in tables.data.items]


def main():
    # 创建client
    client = lark.Client.builder() \
        .app_id("DXP2bDfzXaC6hOsx2XFliaJlgPh") \
        .app_secret("pt-Fh3UE7oqxPtLmGddjvaSZKiIqmBfPT5gZZ1l6meVAQAAH0DAYB9AQEBKEXb_") \
        .log_level(lark.LogLevel.DEBUG) \
        .build()

    # 构造请求对象
    request: ListAppTableRequest = ListAppTableRequest.builder() \
        .page_size(20) \
        .build()

    # 发起请求
    response: ListAppTableResponse = client.bitable.v1.app_table.list(request)

    # 处理失败返回
    if not response.success():
        lark.logger.error(
            f"client.bitable.v1.app_table.list failed, code: {response.code}, msg: {response.msg}, log_id: {response.get_log_id()}, resp: \n{json.dumps(json.loads(response.raw.content), indent=4, ensure_ascii=False)}")
        return

    # 处理业务结果
    lark.logger.info(lark.JSON.marshal(response.data, indent=4))


if __name__ == "__main__":
    main()




