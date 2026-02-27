from typing import List
from langchain_core.output_parsers import XMLOutputParser
from langchain_core.prompts import (
    ChatPromptTemplate,
    HumanMessagePromptTemplate,
    SystemMessagePromptTemplate,
)
from prompt_templates import SYSTEM_PROMPT, SUMMARIZATION_TEMPLATE_PARAGRAPH
from connections import Connections
from utils import parse_summary


def summarization(
    question: str, list_of_answers: List[str], model_name: str = "ClaudeSonnet4_6"
) -> str:
    """
    Summarizes a list of answers for a given question using a Bedrock LLM.

    Inputs:
        - question (str): The question for which the answers need to be summarized.
        - list_of_answers (List[str]): A list of answers provided for the question.
        - model_name (str, optional): The model key to use. Defaults to "ClaudeSonnet4_6".
    Returns:
        - ans (str): The summarized answer.
    """
    parser = XMLOutputParser(tags=["Output", "Summary"])

    system_message_template = SystemMessagePromptTemplate.from_template(SYSTEM_PROMPT)
    human_message_template = HumanMessagePromptTemplate.from_template(
        SUMMARIZATION_TEMPLATE_PARAGRAPH
    )
    prompt = ChatPromptTemplate.from_messages(
        [system_message_template, human_message_template]
    )

    llm = Connections.get_bedrock_llm(max_tokens=4096, model_name=model_name)

    chain = prompt | llm | parser

    input_dict = {
        "input_texts": list_of_answers,
        "format_instructions": parser.get_format_instructions(),
        "input_question": question,
    }

    ans = chain.invoke(input_dict)
    ans = parse_summary(ans)
    return ans
