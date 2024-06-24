from typing import List
from langchain.output_parsers import XMLOutputParser
from langchain_core.prompts import (
    ChatPromptTemplate,
    HumanMessagePromptTemplate,
    SystemMessagePromptTemplate,
)
from prompt_templates import SYSTEM_PROMPT, SUMMARIZATION_TEMPLATE_PARAGRAPH
from connections import Connections
from utils import parse_summary


def summarization(
    question: str, list_of_answers: List[str], model_name: str = "Claude3"
) -> str:
    """
    Summarizes a list of answers for a given question using a specified LLM from Bedrock.

    This function creates a chain of operations including prompt templating, invoking a LLM , and parsing the output,
    to generate a summarized response based on the provided answers.

    Inputs:
        - question (str): The question for which the answers need to be summarized.
        - list_of_answers (List[str]): A list of answers provided for the question.
        - model_name (str, optional): The name of the language model to be used for summarization. Defaults to "Claude3"
    Returns:
        - ans (str): The summarized answer as returned by the language model's output stroutputparser.

    """

    # Initialize output parser object, specifying the tags (to be consistent with the prompt)
    parser = XMLOutputParser(tags=["Output", "Summary"])
    # Prompt from a template & parser
    system_message_template = SystemMessagePromptTemplate.from_template(SYSTEM_PROMPT)
    human_message_template = HumanMessagePromptTemplate.from_template(
        SUMMARIZATION_TEMPLATE_PARAGRAPH
    )
    prompt = ChatPromptTemplate.from_messages(
        [system_message_template, human_message_template]
    )
    # LLM object
    llm = Connections.get_bedrock_llm(max_tokens=2048, model_name=model_name)

    # Chain the elements together
    chain = prompt | llm | parser

    # Define input dict
    input_dict = {
        "input_texts": list_of_answers,
        "format_instructions": parser.get_format_instructions(),
        "input_question": question,
    }

    # Invoke the chain
    ans = chain.invoke(input_dict)

    ans = parse_summary(ans)
    return ans
